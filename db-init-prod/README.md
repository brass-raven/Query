# Production Database Initialization Scripts

This directory contains SQL scripts for the **production** database that run automatically on container startup.

## Connection Details

- **Host**: localhost
- **Port**: 5433 (non-standard to avoid conflicts with dev)
- **Database**: querydb_prod
- **Username**: queryuser
- **Password**: querypass

**Connection String:**
```
postgres://queryuser:querypass@localhost:5433/querydb_prod
```

## Tables Created

### 1. users (1,500 rows)
User accounts with audit fields and soft deletes.
- Columns: id, username, email, full_name, created_at, **updated_at**, **deleted_at**, is_active, **last_login_at**, **login_count**
- Primary key: id
- Unique constraints: username, email
- 5% of users are soft-deleted (deleted_at IS NOT NULL)

### 2. products (750 rows)
Product catalog with SKUs and audit trail.
- Columns: id, name, description, price, stock_quantity, category, **sku**, created_at, updated_at, **created_by**, **updated_by**, **is_published**
- Primary key: id
- Unique constraint: sku
- Categories: Electronics, Clothing, Books, Home & Garden, Sports
- 80% of products are published

### 3. orders (7,500 rows)
Order transactions with shipping tracking and audit trail.
- Columns: id, user_id, product_id, quantity, total_price, status, order_date, **shipped_at**, **delivered_at**, **tracking_number**, **created_by**, **updated_by**, **updated_at**
- Primary key: id
- Foreign keys: user_id → users(id), product_id → products(id)
- Statuses: completed, pending, shipped, delivered, cancelled
- 70% have tracking numbers

### 4. events (1,000,000 rows)
Analytics/tracking data (same as dev).
- Columns: id, event_type, user_id, session_id, ip_address, user_agent, page_url, referrer, event_data, created_at
- Primary key: id
- Event types: page_view, click, form_submit, purchase, signup, logout
- Includes JSONB data for complex queries

### 5. sessions (5,000 rows) - **PROD ONLY**
User session management with tokens and expiration.
- Columns: id, user_id, token, ip_address, user_agent, created_at, expires_at, last_activity_at
- Primary key: id (UUID)
- Unique constraint: token
- Foreign key: user_id → users(id)

### 6. audit_logs (10,000 rows) - **PROD ONLY**
Comprehensive audit trail for compliance.
- Columns: id, table_name, record_id, action, old_values, new_values, changed_by, changed_at, ip_address
- Primary key: id (BIGSERIAL)
- Actions: INSERT, UPDATE, DELETE
- Stores change history as JSONB

## Key Differences from Development

The prod database has **production-ready features**:
- **Audit columns** (created_by, updated_by, updated_at) on most tables
- **Soft deletes** (deleted_at) on users table
- **More rows** (50% more in users, products, orders)
- **Additional tables**: sessions, audit_logs
- **Additional columns**: SKU on products, shipping tracking on orders, login tracking on users
- **More indexes**: Partial indexes for better query performance

See [DATABASE.md](../DATABASE.md) for complete comparison.

## Quick Access

```bash
# Connect via psql
./db-start.sh psql-prod

# View logs
./db-start.sh logs-prod
```

## Example Queries

### Production-Specific Features

Active users (excluding soft deletes):
```sql
SELECT * FROM users
WHERE deleted_at IS NULL AND is_active = true
LIMIT 10;
```

Published products with SKUs:
```sql
SELECT sku, name, price, category
FROM products
WHERE is_published = true
ORDER BY name
LIMIT 20;
```

Shipped orders with tracking:
```sql
SELECT id, tracking_number, shipped_at, delivered_at, status
FROM orders
WHERE tracking_number IS NOT NULL
ORDER BY shipped_at DESC
LIMIT 20;
```

Active sessions:
```sql
SELECT s.token, u.username, s.last_activity_at, s.expires_at
FROM sessions s
JOIN users u ON s.user_id = u.id
WHERE s.expires_at > CURRENT_TIMESTAMP
ORDER BY s.last_activity_at DESC
LIMIT 20;
```

Recent audit activity:
```sql
SELECT table_name, action, changed_by, changed_at,
       new_values->>'status' as new_status
FROM audit_logs
ORDER BY changed_at DESC
LIMIT 30;
```

### Analytics Queries

User login patterns:
```sql
SELECT
    DATE_TRUNC('day', last_login_at) as login_date,
    COUNT(*) as user_count,
    AVG(login_count) as avg_logins
FROM users
WHERE last_login_at IS NOT NULL
  AND deleted_at IS NULL
GROUP BY login_date
ORDER BY login_date DESC
LIMIT 30;
```

Product performance by category:
```sql
SELECT
    p.category,
    COUNT(DISTINCT p.id) as product_count,
    COUNT(o.id) as order_count,
    SUM(o.total_price) as total_revenue
FROM products p
LEFT JOIN orders o ON p.id = o.product_id
WHERE p.is_published = true
GROUP BY p.category
ORDER BY total_revenue DESC;
```

Shipping performance:
```sql
SELECT
    status,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (delivered_at - shipped_at))/3600) as avg_delivery_hours
FROM orders
WHERE shipped_at IS NOT NULL
GROUP BY status
ORDER BY count DESC;
```
