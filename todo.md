# Query - PostgreSQL Desktop Client

A modern, fast PostgreSQL client built with Tauri 2.0, React 19, and TypeScript.

## Core Features (Completed)
- [x] query history
- [x] intellisense
- [x] autocomplete
- [x] double click to run query
- [x] double click on a table to select * from table (already works as single click with limit 100)
- [x] quickly change between connections (dropdown in header + Cmd+Shift+C)
- [x] save & pin queries
- [x] hot query (command + k)
  - Quick commands: SELECT, INSERT, UPDATE, DELETE, DESCRIBE, COUNT for any table
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
- [x] export/import (CSV and JSON)
- [x] show vim mode in ui (already implemented but cannot see)
- [x] settings page with Cmd+, shortcut (4 tabs: General, Editor, Display, Connections)
- [x] update command palette to use shadcn Command component
- [x] read only mode implementation with backend enforcement (only SELECT, DESCRIBE, DESC, SHOW, EXPLAIN)
- [x] manage connections in settings (create, edit, delete)
- [x] connection URL parser (paste postgres://user:pass@host:port/db to auto-fill)
- [x] test connection button on connection form
- [x] enhanced cmd+k with ALL commands (SELECT, INSERT, UPDATE, DELETE, DESCRIBE, COUNT per table)
- [x] modern app layout with AppNew.tsx (resizable panels, shadcn sidebar)
- [x] layout direction toggle (vertical/horizontal split)
- [x] styling improvements:
  - [x] sidebar toggle button in header
  - [x] connection dropdown with "+" for new connection
  - [x] read-only mode indicator in header
  - [x] layout direction toggle button
  - [x] CMD+K button in header
- [x] make table area horizontally scrollable
- [x] remove height constraints from results table (takes up all available space)
- [x] global search across all columns in results
- [x] full-screen results mode with keyboard shortcut (Cmd+Shift+F)
- [x] improved editor styling (custom Monaco theme matching app colors)

- [x] multi-row selection & manipulation
  - [x] Checkbox column for row selection
  - [x] Select all/none functionality
  - [x] Selection count display
  - [x] Copy selected rows to clipboard (CSV/JSON)
  - [x] Visual feedback for selected rows
  - [x] Keyboard shortcuts (Escape to clear)
- [x] inline data editing
  - [x] Edit mode toggle with visual indicator
  - [x] Double-click cells to edit values
  - [x] Dirty data tracking with visual feedback (blue border)
  - [x] Save Changes button (appears when dirty data exists)
  - [x] Generate UPDATE SQL using primary keys
  - [x] Execute updates and re-fetch results
  - [x] Read-only mode enforcement
  - [x] Primary key validation (editing disabled without PK)
- [x] snippet-style tabbing for query templates
  - [x] Fixed insertSnippet to use Monaco's native snippet controller
  - [x] Tab navigation between placeholders (${1:text}, ${2:text}, etc.)
  - [x] Added 8 SQL snippet templates in autocomplete (sel, selj, sellj, selagg, ins, upd, del, cte)
  - [x] Snippets work with existing INSERT/UPDATE/DELETE from sidebar
  - [x] Configured editor for optimal snippet support
- [x] better git integration (commit, push, pull in app)
  - [x] Live git status in sidebar footer (branch name, change count)
  - [x] Interactive buttons for Commit, Push, Pull operations
  - [x] Initialize Repository button when not a git repo
  - [x] GitCommitModal for committing with message and file list
  - [x] Commit message input with Cmd+Enter shortcut
  - [x] Auto-polling git status every 10 seconds
  - [x] Error handling for non-git repositories
  - [x] Shell-based git commands (no additional dependencies)
  - [x] Backend Rust commands: check_git_repo, get_git_status, get_git_log, git_init, git_commit, git_push, git_pull
- [x] header in native macOS title bar (next to traffic lights)
- [x] improved editor styling (better integration with overall design)
- [x] make ui more compact 
  - (moving things into the same rows: results row, edit row on another line, selected meta data on another row, but this could all be moved into one row.)
  - 3 instances of same thing: # rows & time to execute query
- [x] ERD (entity relationship diagram)
- [x] ability in top menu to open the current project directory
- [x] show recent projects in project selector dropdown (a project is a directory)
- [x] schema comparison (dev, staging, prod)
  - [x] Enhanced schema fetching (tables, columns, indexes, foreign keys, views, routines)
  - [x] Full comparison logic with diff detection
  - [x] Migration SQL script generation
  - [x] UI with summary, table details, warnings, and script viewer
  - [x] GitCompareArrows button in header to open comparison modal

### Priority Features
- [ ] app pages should have header (sidebar and compare page)
- [ ] schema comparison better view
  - warnings do not show up in the UI
- [ ] remove unused files
- [ ] remove random "invoke" calls and have a centralized area for all tauri calls
- [ ] remove magic vars

### Future Features
- [ ] robust table manipulation (create, alter, drop tables from UI)
- [ ] variables system, e.g. ${1:text} in the query editor then have a variable editor to edit them.
- [ ] other database types:
  - mysql
  - mongodb (nosql)

### Low Priority
- [ ] cancel query (abort long-running queries)
- [ ] break out large files to separate files
- [ ] general refactoring and cleanup
- [ ] github action workflow for building and publishing
- [ ] db url parse not allowing to paste in.

---

## Design Mockups & Examples

### Schema Comparison Feature (Detailed Mockup)

Example of schema comparison UI:
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


