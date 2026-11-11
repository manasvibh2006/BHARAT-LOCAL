import { randomUUID } from 'crypto';
import { getPgPool, isPgConnected, testPostgresConnection } from './connection';
import { memoryDb } from './memory-db';
import { User, Post, PostReport, ModerationAction, Notification, Category } from './schema';
import { POST_CATEGORIES } from '../config/constants';

function uuidv4(): string {
  return randomUUID();
}

export interface FeedFilterOptions {
  city?: string;
  state?: string;
  locality?: string;
  pincode?: string;
  category?: string;
  language?: string;
  page?: number;
  limit?: number;
  sort?: 'latest' | 'oldest' | 'popular';
}

export interface SearchFilterOptions extends FeedFilterOptions {
  query: string;
}

export class DatabaseAdapter {
  private static instance: DatabaseAdapter;

  public static getInstance(): DatabaseAdapter {
    if (!DatabaseAdapter.instance) {
      DatabaseAdapter.instance = new DatabaseAdapter();
    }
    return DatabaseAdapter.instance;
  }

  // Check health and backend type
  public async getStatus(): Promise<{ mode: 'postgres' | 'memory'; healthy: boolean }> {
    const isPg = await testPostgresConnection();
    return {
      mode: isPg ? 'postgres' : 'memory',
      healthy: true
    };
  }

  // --------------------------------------------------------------------------
  // USER METHODS
  // --------------------------------------------------------------------------
  public async findUserByPhone(phone: string): Promise<User | null> {
    if (isPgConnected()) {
      const pool = getPgPool();
      const res = await pool!.query('SELECT * FROM users WHERE phone = $1 LIMIT 1', [phone]);
      return res.rows[0] || null;
    }
    for (const user of memoryDb.users.values()) {
      if (user.phone === phone) return user;
    }
    return null;
  }

  public async findUserById(id: string): Promise<User | null> {
    if (isPgConnected()) {
      const pool = getPgPool();
      const res = await pool!.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
      return res.rows[0] || null;
    }
    return memoryDb.users.get(id) || null;
  }

  public async createUser(data: Omit<User, 'id' | 'is_banned' | 'created_at' | 'updated_at'>): Promise<User> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const newUser: User = {
      id,
      ...data,
      is_banned: false,
      created_at: now,
      updated_at: now
    };

    if (isPgConnected()) {
      const pool = getPgPool();
      const res = await pool!.query(
        `INSERT INTO users (id, phone, name, role, preferred_language, state, city, locality, pincode, latitude, longitude)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          id,
          newUser.phone,
          newUser.name,
          newUser.role,
          newUser.preferred_language,
          newUser.state,
          newUser.city,
          newUser.locality || null,
          newUser.pincode,
          newUser.latitude || null,
          newUser.longitude || null
        ]
      );
      return res.rows[0];
    }

    memoryDb.users.set(id, newUser);
    return newUser;
  }

  public async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const now = new Date().toISOString();

    if (isPgConnected()) {
      const pool = getPgPool();
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      for (const [key, val] of Object.entries(updates)) {
        if (key !== 'id' && key !== 'created_at') {
          fields.push(`${key} = $${idx++}`);
          values.push(val);
        }
      }
      fields.push(`updated_at = $${idx++}`);
      values.push(now);
      values.push(id);

      const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
      const res = await pool!.query(query, values);
      return res.rows[0] || null;
    }

    const existing = memoryDb.users.get(id);
    if (!existing) return null;

    const updated = { ...existing, ...updates, updated_at: now };
    memoryDb.users.set(id, updated);
    return updated;
  }

  // --------------------------------------------------------------------------
  // FEED & POST METHODS
  // --------------------------------------------------------------------------
  public async getFeedPosts(opts: FeedFilterOptions): Promise<{
    posts: Post[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(50, Math.max(1, opts.limit || 10));
    const offset = (page - 1) * limit;

    if (isPgConnected()) {
      const pool = getPgPool();
      const conditions: string[] = ["p.status = 'active'"];
      const params: any[] = [];
      let idx = 1;

      if (opts.city) {
        conditions.push(`LOWER(p.city) = LOWER($${idx++})`);
        params.push(opts.city);
      }
      if (opts.locality) {
        conditions.push(`LOWER(p.locality) LIKE LOWER($${idx++})`);
        params.push(`%${opts.locality}%`);
      }
      if (opts.pincode) {
        conditions.push(`p.pincode = $${idx++}`);
        params.push(opts.pincode);
      }
      if (opts.category && opts.category !== 'all') {
        conditions.push(`p.category_id = $${idx++}`);
        params.push(opts.category);
      }
      if (opts.language && opts.language !== 'all') {
        conditions.push(`p.language = $${idx++}`);
        params.push(opts.language);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      let orderBy = 'p.created_at DESC';
      if (opts.sort === 'oldest') orderBy = 'p.created_at ASC';
      if (opts.sort === 'popular') orderBy = 'p.view_count DESC, p.created_at DESC';

      const countSql = `SELECT COUNT(*) FROM posts p ${whereClause}`;
      const countRes = await pool!.query(countSql, params);
      const total = parseInt(countRes.rows[0].count, 10);

      const dataSql = `
        SELECT p.*, u.name as author_name, u.phone as author_phone, c.name_en as category_name
        FROM posts p
        JOIN users u ON p.author_id = u.id
        JOIN categories c ON p.category_id = c.id
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${idx++} OFFSET $${idx++}
      `;
      params.push(limit, offset);
      const dataRes = await pool!.query(dataSql, params);

      return {
        posts: dataRes.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }

    // Memory Mode
    let filtered = Array.from(memoryDb.posts.values()).filter((p) => p.status === 'active');

    if (opts.city) {
      filtered = filtered.filter((p) => p.city.toLowerCase() === opts.city!.toLowerCase());
    }
    if (opts.locality) {
      filtered = filtered.filter((p) => p.locality?.toLowerCase().includes(opts.locality!.toLowerCase()));
    }
    if (opts.pincode) {
      filtered = filtered.filter((p) => p.pincode === opts.pincode);
    }
    if (opts.category && opts.category !== 'all') {
      filtered = filtered.filter((p) => p.category_id === opts.category);
    }
    if (opts.language && opts.language !== 'all') {
      filtered = filtered.filter((p) => p.language === opts.language);
    }

    if (opts.sort === 'oldest') {
      filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (opts.sort === 'popular') {
      filtered.sort((a, b) => b.view_count - a.view_count);
    } else {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      posts: paginated,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  public async searchPosts(opts: SearchFilterOptions): Promise<{
    posts: Post[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(50, Math.max(1, opts.limit || 10));
    const offset = (page - 1) * limit;
    const q = opts.query.trim().toLowerCase();

    if (isPgConnected()) {
      const pool = getPgPool();
      const conditions: string[] = ["p.status = 'active'"];
      const params: any[] = [];
      let idx = 1;

      if (q) {
        conditions.push(`(
          p.title ILIKE $${idx} OR 
          p.content ILIKE $${idx} OR 
          p.locality ILIKE $${idx} OR 
          p.pincode ILIKE $${idx}
        )`);
        params.push(`%${q}%`);
        idx++;
      }

      if (opts.city) {
        conditions.push(`LOWER(p.city) = LOWER($${idx++})`);
        params.push(opts.city);
      }
      if (opts.category && opts.category !== 'all') {
        conditions.push(`p.category_id = $${idx++}`);
        params.push(opts.category);
      }
      if (opts.language && opts.language !== 'all') {
        conditions.push(`p.language = $${idx++}`);
        params.push(opts.language);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const countRes = await pool!.query(`SELECT COUNT(*) FROM posts p ${whereClause}`, params);
      const total = parseInt(countRes.rows[0].count, 10);

      const dataSql = `
        SELECT p.*, u.name as author_name, u.phone as author_phone, c.name_en as category_name
        FROM posts p
        JOIN users u ON p.author_id = u.id
        JOIN categories c ON p.category_id = c.id
        ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}
      `;
      params.push(limit, offset);
      const dataRes = await pool!.query(dataSql, params);

      return {
        posts: dataRes.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }

    // Memory Mode Search
    let filtered = Array.from(memoryDb.posts.values()).filter((p) => p.status === 'active');

    if (q) {
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          (p.locality && p.locality.toLowerCase().includes(q)) ||
          p.pincode.includes(q) ||
          p.city.toLowerCase().includes(q)
      );
    }
    if (opts.city) {
      filtered = filtered.filter((p) => p.city.toLowerCase() === opts.city!.toLowerCase());
    }
    if (opts.category && opts.category !== 'all') {
      filtered = filtered.filter((p) => p.category_id === opts.category);
    }
    if (opts.language && opts.language !== 'all') {
      filtered = filtered.filter((p) => p.language === opts.language);
    }

    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      posts: paginated,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  public async getPostById(id: string, incrementView = false): Promise<Post | null> {
    if (isPgConnected()) {
      const pool = getPgPool();
      if (incrementView) {
        await pool!.query('UPDATE posts SET view_count = view_count + 1 WHERE id = $1', [id]);
      }
      const res = await pool!.query(
        `SELECT p.*, u.name as author_name, u.phone as author_phone, c.name_en as category_name
         FROM posts p
         JOIN users u ON p.author_id = u.id
         JOIN categories c ON p.category_id = c.id
         WHERE p.id = $1 LIMIT 1`,
        [id]
      );
      return res.rows[0] || null;
    }

    const post = memoryDb.posts.get(id);
    if (!post) return null;
    if (incrementView) {
      post.view_count += 1;
      memoryDb.posts.set(id, post);
    }
    return post;
  }

  public async createPost(
    data: Omit<Post, 'id' | 'status' | 'report_count' | 'view_count' | 'created_at' | 'updated_at'>
  ): Promise<Post> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const author = await this.findUserById(data.author_id);
    const category = POST_CATEGORIES.find((c) => c.id === data.category_id);

    const newPost: Post = {
      id,
      ...data,
      author_name: author?.name || 'Local Resident',
      author_phone: author?.phone,
      category_name: category?.name_en || data.category_id,
      status: 'active',
      report_count: 0,
      view_count: 0,
      created_at: now,
      updated_at: now
    };

    if (isPgConnected()) {
      const pool = getPgPool();
      const res = await pool!.query(
        `INSERT INTO posts (
          id, author_id, category_id, title, content, language,
          state, city, locality, pincode, latitude, longitude, contact_info, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'active')
        RETURNING *`,
        [
          id,
          newPost.author_id,
          newPost.category_id,
          newPost.title,
          newPost.content,
          newPost.language,
          newPost.state,
          newPost.city,
          newPost.locality || null,
          newPost.pincode,
          newPost.latitude || null,
          newPost.longitude || null,
          newPost.contact_info || null
        ]
      );
      const row = res.rows[0];
      row.author_name = author?.name;
      row.category_name = category?.name_en;
      return row;
    }

    memoryDb.posts.set(id, newPost);
    return newPost;
  }

  public async updatePost(id: string, updates: Partial<Post>): Promise<Post | null> {
    const now = new Date().toISOString();

    if (isPgConnected()) {
      const pool = getPgPool();
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      for (const [key, val] of Object.entries(updates)) {
        if (key !== 'id' && key !== 'created_at' && key !== 'author_id') {
          fields.push(`${key} = $${idx++}`);
          values.push(val);
        }
      }
      fields.push(`updated_at = $${idx++}`);
      values.push(now);
      values.push(id);

      const res = await pool!.query(
        `UPDATE posts SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
      return res.rows[0] || null;
    }

    const post = memoryDb.posts.get(id);
    if (!post) return null;
    const updated = { ...post, ...updates, updated_at: now };
    memoryDb.posts.set(id, updated);
    return updated;
  }

  public async deletePost(id: string): Promise<boolean> {
    if (isPgConnected()) {
      const pool = getPgPool();
      const res = await pool!.query('DELETE FROM posts WHERE id = $1', [id]);
      return (res.rowCount ?? 0) > 0;
    }
    return memoryDb.posts.delete(id);
  }

  // --------------------------------------------------------------------------
  // REPORTING & MODERATION METHODS
  // --------------------------------------------------------------------------
  public async createReport(data: {
    post_id: string;
    reporter_id: string;
    reason: PostReport['reason'];
    details?: string;
  }): Promise<{ report: PostReport; post: Post }> {
    const reportId = uuidv4();
    const now = new Date().toISOString();
    const reporter = await this.findUserById(data.reporter_id);
    const post = await this.getPostById(data.post_id);

    if (!post) {
      throw new Error('Post not found');
    }

    const newReport: PostReport = {
      id: reportId,
      post_id: data.post_id,
      reporter_id: data.reporter_id,
      reporter_name: reporter?.name,
      reason: data.reason,
      details: data.details,
      status: 'pending',
      created_at: now,
      post_title: post.title,
      post_content: post.content
    };

    if (isPgConnected()) {
      const pool = getPgPool();
      await pool!.query(
        `INSERT INTO post_reports (id, post_id, reporter_id, reason, details, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')`,
        [reportId, data.post_id, data.reporter_id, data.reason, data.details || null]
      );
      // Increment report count & auto-flag if threshold reached
      const updateRes = await pool!.query(
        `UPDATE posts 
         SET report_count = report_count + 1,
             status = CASE WHEN report_count + 1 >= 3 THEN 'flagged' ELSE status END
         WHERE id = $1
         RETURNING *`,
        [data.post_id]
      );
      return { report: newReport, post: updateRes.rows[0] };
    }

    memoryDb.reports.set(reportId, newReport);
    post.report_count += 1;
    if (post.report_count >= 3 && post.status === 'active') {
      post.status = 'flagged';
    }
    memoryDb.posts.set(post.id, post);

    return { report: newReport, post };
  }

  public async getModerationQueue(status: string = 'pending'): Promise<PostReport[]> {
    if (isPgConnected()) {
      const pool = getPgPool();
      const res = await pool!.query(
        `SELECT r.*, p.title as post_title, p.content as post_content, p.status as post_status,
                u.name as reporter_name
         FROM post_reports r
         JOIN posts p ON r.post_id = p.id
         JOIN users u ON r.reporter_id = u.id
         WHERE ($1 = 'all' OR r.status = $1)
         ORDER BY r.created_at DESC`,
        [status]
      );
      return res.rows;
    }

    let reports = Array.from(memoryDb.reports.values());
    if (status !== 'all') {
      reports = reports.filter((r) => r.status === status);
    }
    reports.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return reports;
  }

  public async moderatePost(params: {
    postId: string;
    moderatorId: string;
    action: 'approved' | 'rejected' | 'hidden' | 'restored' | 'user_banned';
    notes?: string;
  }): Promise<{ post: Post; actionLog: ModerationAction }> {
    const post = await this.getPostById(params.postId);
    if (!post) throw new Error('Post not found');

    let newStatus: Post['status'] = post.status;
    if (params.action === 'approved' || params.action === 'restored') {
      newStatus = 'active';
    } else if (params.action === 'rejected') {
      newStatus = 'rejected';
    } else if (params.action === 'hidden') {
      newStatus = 'hidden';
    }

    const actionLogId = uuidv4();
    const now = new Date().toISOString();
    const actionLog: ModerationAction = {
      id: actionLogId,
      post_id: params.postId,
      moderator_id: params.moderatorId,
      action: params.action,
      notes: params.notes,
      created_at: now
    };

    if (isPgConnected()) {
      const pool = getPgPool();
      await pool!.query(
        `INSERT INTO moderation_actions (id, post_id, moderator_id, action, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [actionLogId, params.postId, params.moderatorId, params.action, params.notes || null]
      );
      const updateRes = await pool!.query(
        `UPDATE posts SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [newStatus, params.postId]
      );
      // Mark associated reports resolved
      await pool!.query(
        `UPDATE post_reports 
         SET status = 'action_taken', resolved_by = $1, resolved_at = NOW() 
         WHERE post_id = $2 AND status = 'pending'`,
        [params.moderatorId, params.postId]
      );
      return { post: updateRes.rows[0], actionLog };
    }

    post.status = newStatus;
    post.updated_at = now;
    memoryDb.posts.set(post.id, post);
    memoryDb.moderationActions.push(actionLog);

    for (const report of memoryDb.reports.values()) {
      if (report.post_id === params.postId && report.status === 'pending') {
        report.status = 'action_taken';
        report.resolved_by = params.moderatorId;
        report.resolved_at = now;
      }
    }

    return { post, actionLog };
  }

  // --------------------------------------------------------------------------
  // NOTIFICATION METHODS
  // --------------------------------------------------------------------------
  public async createNotification(data: {
    recipient_id: string;
    type: string;
    title: string;
    message: string;
    payload?: Record<string, any>;
  }): Promise<Notification> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const notif: Notification = {
      id,
      recipient_id: data.recipient_id,
      type: data.type,
      title: data.title,
      message: data.message,
      payload: data.payload || {},
      is_read: false,
      delivery_status: 'delivered',
      created_at: now
    };

    if (isPgConnected()) {
      const pool = getPgPool();
      const res = await pool!.query(
        `INSERT INTO notifications (id, recipient_id, type, title, message, payload, is_read, delivery_status)
         VALUES ($1, $2, $3, $4, $5, $6, false, 'delivered')
         RETURNING *`,
        [id, notif.recipient_id, notif.type, notif.title, notif.message, JSON.stringify(notif.payload)]
      );
      return res.rows[0];
    }

    memoryDb.notifications.set(id, notif);
    return notif;
  }

  public async getUserNotifications(recipientId: string, limit = 20): Promise<Notification[]> {
    if (isPgConnected()) {
      const pool = getPgPool();
      const res = await pool!.query(
        `SELECT * FROM notifications 
         WHERE recipient_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [recipientId, limit]
      );
      return res.rows;
    }

    const userNotifs = Array.from(memoryDb.notifications.values())
      .filter((n) => n.recipient_id === recipientId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    return userNotifs;
  }

  public async markNotificationRead(id: string, recipientId: string): Promise<boolean> {
    if (isPgConnected()) {
      const pool = getPgPool();
      const res = await pool!.query(
        'UPDATE notifications SET is_read = true WHERE id = $1 AND recipient_id = $2',
        [id, recipientId]
      );
      return (res.rowCount ?? 0) > 0;
    }

    const n = memoryDb.notifications.get(id);
    if (n && n.recipient_id === recipientId) {
      n.is_read = true;
      memoryDb.notifications.set(id, n);
      return true;
    }
    return false;
  }

  public getCategories(): Category[] {
    return Array.from(memoryDb.categories.values());
  }

  public getAllModeratorsAndAdmins(): User[] {
    return Array.from(memoryDb.users.values()).filter(
      (u) => (u.role === 'moderator' || u.role === 'admin') && !u.is_banned
    );
  }
}

export const db = DatabaseAdapter.getInstance();
