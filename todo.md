- [x] query history
- [x] intellisense
- [x] autocomplete
- [x] double click to run query
- [x] double click on a table to select * from table (already works as single click with limit 100)
- [x] quickly change between connections (dropdown in header + Cmd+Shift+C)
- [x] save & pin queries
- [x] hot query (command + k)
  - Quick commands: SELECT, UPDATE, DESCRIBE, COUNT for any table
  - Fuzzy search for tables
  - Shows recent queries from history
- [x] vim keybindings (toggleable with VIM button)
- [x] tanstack table (with sorting, filtering, virtual scrolling)
- [x] quick preview of query results (compact/expand toggle)
- [x] store data in a specific location (project directory picker)
- [x] save encrypted data locally (OS keychain for passwords)
- [x] open a project (select directory to store connections/history/queries)
- [x] restructure app
  - move components to their own folder
  - move styles to their own folder
  - move functions to their own folder
  - move types to their own folder
  - move constants to their own folder
- [x] speed (when having a lot of lines, the app is slow, need to optimize and lazy load the results)
- [x] export/import
- [x] show vim mode in ui (already implemented but cannot see)

### feats
- [ ] cancel query
- [ ] settings page instead of a modal - vim mode should be in here
- [ ] update dialog to look better (use shadcn) - use shadcn command for the quic action dialog
- [ ] inline data editing
- [ ] search & filter within results
- [ ] better git integration (commit, push, pull in app) - **currently commented out, needs fixing**
- [ ] read only mode implementation: only allow select, describe, and count queries - store this in the config for the specific environment, for example, maybe whenever i want to use prod env, i want it set to read only
- [ ] variables (maybe not needed?)
- [ ] ERD
- [ ] schema comparison (dev, staging, prod)
- [ ] robust table manipulation
- [ ] other languages
  - mysql
  - mongodb (nosql)
- [ ] styling:
  - left sidebar needs to be able to move
  - update header: should look like this from left to right: 
    - sidebar toggle, 
    - "Env [prod]" (the env name is a dropdown to click on and a plus button is in the dropdown to create a new connection), 
    - read only mode
    - on far right side: toggle which way the results are displayed (vertical or horizontal), then a "CMD+K" button to toggle the quick actions menu
  - bottom of sidebar: git actions (commit, push, pull, or "init")
  - table columns hide and show
  - better look for the editor, looks out of place (style and everything)
- [ ] snippet stype tabbing, for example when you do the "cmd+k" and do the "update user" command, it should write in the the editor: "UPDATE users SET name = '$1' WHERE id = $2;" and then you can tab to the next field
- [ ] manage connections in settings (create, delete, rename, etc.)
- [ ] open settings with command + , 
- [ ] make table area scrollable from left to right
- [ ] header information should be in the very top of the app, right next to the "x", "-", and expand buttons on mac. this may be a tauri setting.


example of schema comparison:
```
┌─────────────────────────────────────────────────────┐
│ Schema Comparison: development → production         │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Summary:                                            │
│  ● 3 tables modified                                │
│  ● 1 table added                                    │
│  ● 0 tables deleted                                 │
│  ● 2 indexes missing in target                      │
│  ● 1 stored procedure changed                       │
│                                                     │
│ [Show All] [Show Differences Only] [Show Conflicts] │
└─────────────────────────────────────────────────────┘
```

---

## 🔍 **Detailed Object List**

### **Side-by-Side Tree View:**
```
┌─────────────────────┬─────────────────────────────────────────┐
│ Database Objects    │  Status                                  │
├─────────────────────┼─────────────────────────────────────────┤
│ 📁 Tables           │                                          │
│  ☑ users            │ 🟡 Modified (2 columns changed)         │
│  ☑ orders           │ 🟡 Modified (1 index added)             │
│  ☑ products         │ ⚪ Identical                            │
│  ☑ reviews          │ 🟢 New in source (will be created)      │
│  ☐ old_logs         │ 🔴 Only in target (will be deleted)     │
│                     │                                          │
│ 📁 Indexes          │                                          │
│  ☑ idx_user_email   │ 🟢 New in source                        │
│  ☑ idx_order_date   │ 🟢 New in source                        │
│                     │                                          │
│ 📁 Views            │                                          │
│  ☑ vw_active_users  │ 🟡 Modified (query changed)             │
│                     │                                          │
│ 📁 Stored Procs     │                                          │
│  ☑ sp_calculate_rev │ 🟡 Modified (logic changed)             │
│                     │                                          │
│ [Select All] [Deselect] [Generate Script]                     │
└─────────────────────┴─────────────────────────────────────────┘
```

**Legend:**
- ✅ Checked = Include in sync
- 🟢 Green = New (exists in source only)
- 🔴 Red = Deleted (exists in target only)  
- 🟡 Yellow = Modified (different in both)
- ⚪ Gray = Identical (no changes)

---

## 🔬 **Drill-Down: Table Comparison**

### **Click on "users" table to see details:**

```
┌──────────────────────────────────────────────────────────────┐
│ Table: users                                                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Column Changes:                                              │
│                                                              │
│ Column Name      │ Source (dev)        │ Target (prod)      │
│─────────────────┼────────────────────┼────────────────────│
│ id              │ INT PRIMARY KEY    │ INT PRIMARY KEY    │ ⚪
│ email           │ VARCHAR(255)       │ VARCHAR(100) ⚠️    │ 🟡
│ password_hash   │ VARCHAR(255)       │ VARCHAR(255)       │ ⚪
│ created_at      │ TIMESTAMP          │ TIMESTAMP          │ ⚪
│ verified_at     │ TIMESTAMP NULL     │ [MISSING] ⚠️       │ 🟢
│ last_login      │ [REMOVED] ⚠️       │ TIMESTAMP          │ 🔴
│                                                              │
│ ⚠️ Changes Detected:                                         │
│  • email: Length increased 100 → 255                        │
│  • verified_at: New column (will be added)                  │
│  • last_login: Column removed (will be dropped)             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 📝 **Diff View: Line-by-Line Changes**

### **Traditional "Git-style" diff:**

```
┌──────────────────────────────────────────────────────────────┐
│ Table: users - DDL Comparison                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Source (development):          │ Target (production):        │
│────────────────────────────────┼────────────────────────────│
│ CREATE TABLE users (           │ CREATE TABLE users (        │
│   id INT PRIMARY KEY,          │   id INT PRIMARY KEY,       │
│   email VARCHAR(255),          │   email VARCHAR(100), ◄─🟡  │
│   password_hash VARCHAR(255),  │   password_hash VARCHAR..., │
│   created_at TIMESTAMP,        │   created_at TIMESTAMP,     │
│   verified_at TIMESTAMP NULL ◄─🟢 [MISSING IN TARGET]        │
│   [REMOVED FROM SOURCE] ───►🔴 │   last_login TIMESTAMP,     │
│ );                             │ );                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Color coding:**
- 🟢 Green highlighting = Addition
- 🔴 Red highlighting = Deletion
- 🟡 Yellow highlighting = Modification

---

## 🔧 **Index Comparison**

### **Missing indexes highlighted:**

```
┌──────────────────────────────────────────────────────────────┐
│ Indexes on table: orders                                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Index Name          │ Columns           │ Status            │
│────────────────────┼──────────────────┼──────────────────│
│ pk_orders          │ id                │ ⚪ Identical      │
│ idx_user_id        │ user_id           │ ⚪ Identical      │
│ idx_created_at     │ created_at        │ ⚪ Identical      │
│ idx_status_date    │ status, date   🟢  │ ⚠️ Missing in prod│
│                                                              │
│ ⚡ Performance Impact:                                       │
│   Adding idx_status_date will improve queries filtering     │
│   by status and date (estimated 70% faster)                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## ⚡ **Generated Migration Script**

### **Click "Generate Script" → Get SQL:**

```sql
-- ============================================
-- Schema Migration Script
-- Source: development
-- Target: production
-- Generated: 2024-11-14 10:30:15
-- ============================================

-- WARNING: This script will make changes to production!
-- Review carefully before executing.

-- ============================================
-- TABLE MODIFICATIONS
-- ============================================

-- Modify table: users
ALTER TABLE users 
  MODIFY COLUMN email VARCHAR(255);  -- Was: VARCHAR(100)

ALTER TABLE users 
  ADD COLUMN verified_at TIMESTAMP NULL;

ALTER TABLE users 
  DROP COLUMN last_login;

-- ============================================
-- NEW TABLES
-- ============================================

CREATE TABLE reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  rating INT NOT NULL,
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_order_date ON orders(created_at);
CREATE INDEX idx_status_date ON orders(status, created_at);

-- ============================================
-- VIEWS
-- ============================================

DROP VIEW IF EXISTS vw_active_users;

CREATE VIEW vw_active_users AS
  SELECT id, email, created_at
  FROM users
  WHERE verified_at IS NOT NULL
    AND last_login > NOW() - INTERVAL 30 DAY;

-- ============================================
-- STORED PROCEDURES
-- ============================================

DROP PROCEDURE IF EXISTS sp_calculate_revenue;

DELIMITER $$
CREATE PROCEDURE sp_calculate_revenue(IN start_date DATE, IN end_date DATE)
BEGIN
  -- New implementation with improved performance
  SELECT SUM(total) as revenue
  FROM orders
  WHERE created_at BETWEEN start_date AND end_date
    AND status = 'completed';
END$$
DELIMITER ;

-- ============================================
-- END OF SCRIPT
-- Affected objects: 8
-- Estimated execution time: ~2 seconds
-- ============================================
```

---

## 🎛️ **Advanced Options**

### **Customization Panel:**

```
┌──────────────────────────────────────────────┐
│ Comparison Options                           │
├──────────────────────────────────────────────┤
│                                              │
│ Objects to Compare:                          │
│ ☑ Tables                                     │
│ ☑ Columns                                    │
│ ☑ Indexes                                    │
│ ☑ Foreign Keys                               │
│ ☑ Views                                      │
│ ☑ Stored Procedures                          │
│ ☑ Triggers                                   │
│ ☐ Users/Permissions                          │
│                                              │
│ Ignore:                                      │
│ ☑ Auto-increment values                      │
│ ☑ Table comments                             │
│ ☐ Column order                               │
│ ☐ Index names (compare structure only)      │
│                                              │
│ Advanced:                                    │
│ ☑ Generate rollback script                   │
│ ☑ Include transaction wrapper                │
│ ☐ Add timing information                     │
│                                              │
└──────────────────────────────────────────────┘
```

---

## ⚠️ **Conflict Detection**

### **When there are risky changes:**

```
┌──────────────────────────────────────────────────────────────┐
│ ⚠️  WARNINGS DETECTED                                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ 🔴 HIGH RISK:                                                │
│  • Dropping column 'last_login' will result in data loss    │
│    → 45,234 rows contain data in this column                │
│    → Consider backing up first                              │
│                                                              │
│ 🟡 MEDIUM RISK:                                              │
│  • Modifying column 'email' from VARCHAR(100) to VARCHAR(255)│
│    → Will lock table during modification (~5 seconds)       │
│    → 12 existing values exceed 100 characters (will be OK)  │
│                                                              │
│ 🟢 LOW RISK:                                                 │
│  • Adding new column 'verified_at' with NULL default        │
│    → No data loss, backward compatible                      │
│                                                              │
│ [View Details] [Generate Backup Script] [Continue Anyway]   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔄 **Real-Time Sync Options**

### **Three deployment modes:**

```
┌──────────────────────────────────────────────┐
│ How do you want to apply changes?           │
├──────────────────────────────────────────────┤
│                                              │
│ ○ Execute Now                                │
│   Apply changes immediately to target        │
│   ⚠️ Cannot be undone                        │
│                                              │
│ ● Save Script                                │
│   Review and execute manually later          │
│   ✓ Safe, recommended for production         │
│                                              │
│ ○ Schedule                                   │
│   Apply during maintenance window            │
│   Date: [Nov 15, 2024] Time: [02:00 AM]     │
│                                              │
│ ☑ Generate rollback script                   │
│ ☑ Create backup before applying               │
│                                              │
│ [Cancel] [Generate Script]                   │
└──────────────────────────────────────────────┘
```

---


