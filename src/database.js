const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dataDir = path.join(__dirname, "../data");
const dbPath = path.join(dataDir, "invitations.db");

if (!fs.existsSync(dataDir)) {
	fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    pronoun TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_slug ON invitations(slug);
`);

const generateSlug = () => {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
	let slug = "";
	for (let i = 0; i < 5; i++) {
		slug += chars[Math.floor(Math.random() * chars.length)];
	}
	return slug;
};

// Database operations
const invitationDb = {
	// Get invitation by slug
	getBySlug(slug) {
		const stmt = db.prepare("SELECT * FROM invitations WHERE slug = ?");
		return stmt.get(slug);
	},

	// Get all invitations
	getAll() {
		const stmt = db.prepare("SELECT * FROM invitations ORDER BY created_at DESC");
		return stmt.all();
	},

	// Search invitations
	search(query) {
		const stmt = db.prepare("SELECT * FROM invitations WHERE name LIKE ? OR slug LIKE ? ORDER BY created_at DESC");
		const searchTerm = `%${query}%`;
		return stmt.all(searchTerm, searchTerm);
	},

	// Create invitation
	create(data) {
		let slug = data.slug;

		// Generate slug if not provided
		if (!slug) {
			let attempts = 0;
			do {
				slug = generateSlug();
				attempts++;
			} while (this.getBySlug(slug) && attempts < 10);

			if (attempts >= 10) {
				throw new Error("Failed to generate unique slug");
			}
		}

		const stmt = db.prepare("INSERT INTO invitations (slug, name, pronoun, message) VALUES (?, ?, ?, ?)");

		try {
			const result = stmt.run(slug, data.name, data.pronoun, data.message);
			return { id: result.lastInsertRowid, slug, ...data };
		} catch (error) {
			if (error.message.includes("UNIQUE constraint failed")) {
				throw new Error("Slug already exists");
			}
			throw error;
		}
	},

	// Update invitation
	update(id, data) {
		const stmt = db.prepare("UPDATE invitations SET name = ?, pronoun = ?, message = ?, slug = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");

		try {
			const result = stmt.run(data.name, data.pronoun, data.message, data.slug, id);
			return result.changes > 0;
		} catch (error) {
			if (error.message.includes("UNIQUE constraint failed")) {
				throw new Error("Slug already exists");
			}
			throw error;
		}
	},

	// Delete invitation
	delete(id) {
		const stmt = db.prepare("DELETE FROM invitations WHERE id = ?");
		const result = stmt.run(id);
		return result.changes > 0;
	},

	// Get invitation by ID
	getById(id) {
		const stmt = db.prepare("SELECT * FROM invitations WHERE id = ?");
		return stmt.get(id);
	}
};

module.exports = { db, invitationDb };
