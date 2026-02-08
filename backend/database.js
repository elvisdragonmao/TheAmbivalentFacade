const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const cron = require("node-cron");

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
    inviteToParty INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS rsvp_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    name TEXT,
    email TEXT,
    phone TEXT,
    response TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(slug)
  );
  
  CREATE INDEX IF NOT EXISTS idx_slug ON invitations(slug);
  CREATE INDEX IF NOT EXISTS idx_rsvp_slug ON rsvp_responses(slug);
`);

// Migration: Add inviteToParty column if it doesn't exist
try {
	const columns = db.prepare("PRAGMA table_info(invitations)").all();
	const hasInviteToParty = columns.some(col => col.name === "inviteToParty");

	if (!hasInviteToParty) {
		db.exec("ALTER TABLE invitations ADD COLUMN inviteToParty INTEGER DEFAULT 1");
		console.log("Migration: Added inviteToParty column");
	}
} catch (error) {
	console.error("Migration error:", error);
}

const generateSlug = () => {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
	let slug = "";
	for (let i = 0; i < 5; i++) {
		slug += chars[Math.floor(Math.random() * chars.length)];
	}
	return slug;
};

// Helper function to convert inviteToParty to boolean
const convertInvitation = inv => {
	if (!inv) return null;
	return {
		...inv,
		inviteToParty: Boolean(inv.inviteToParty)
	};
};

const convertInvitations = invitations => {
	return invitations.map(convertInvitation);
};

// Database operations
const invitationDb = {
	// Get invitation by slug
	getBySlug(slug) {
		const stmt = db.prepare("SELECT * FROM invitations WHERE slug = ?");
		return convertInvitation(stmt.get(slug));
	},

	// Get all invitations
	getAll() {
		const stmt = db.prepare("SELECT * FROM invitations ORDER BY created_at DESC");
		return convertInvitations(stmt.all());
	},

	// Search invitations
	search(query) {
		const stmt = db.prepare("SELECT * FROM invitations WHERE name LIKE ? OR slug LIKE ? ORDER BY created_at DESC");
		const searchTerm = `%${query}%`;
		return convertInvitations(stmt.all(searchTerm, searchTerm));
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

		const inviteToParty = data.inviteToParty !== undefined ? (data.inviteToParty ? 1 : 0) : 1;
		const stmt = db.prepare("INSERT INTO invitations (slug, name, pronoun, message, inviteToParty) VALUES (?, ?, ?, ?, ?)");

		try {
			const result = stmt.run(slug, data.name, data.pronoun, data.message, inviteToParty);
			return { id: result.lastInsertRowid, slug, ...data, inviteToParty: Boolean(inviteToParty) };
		} catch (error) {
			if (error.message.includes("UNIQUE constraint failed")) {
				throw new Error("Slug already exists");
			}
			throw error;
		}
	},

	// Update invitation
	update(id, data) {
		const inviteToParty = data.inviteToParty !== undefined ? (data.inviteToParty ? 1 : 0) : 1;
		const stmt = db.prepare("UPDATE invitations SET name = ?, pronoun = ?, message = ?, slug = ?, inviteToParty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");

		try {
			const result = stmt.run(data.name, data.pronoun, data.message, data.slug, inviteToParty, id);
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
		return convertInvitation(stmt.get(id));
	}
};

// RSVP operations
const rsvpDb = {
	// Submit or update RSVP response
	submitResponse(data) {
		const stmt = db.prepare(`
			INSERT INTO rsvp_responses (slug, name, email, phone, response)
			VALUES (?, ?, ?, ?, ?)
			ON CONFLICT(slug) DO UPDATE SET
				name = excluded.name,
				email = excluded.email,
				phone = excluded.phone,
				response = excluded.response,
				updated_at = CURRENT_TIMESTAMP
		`);

		const result = stmt.run(data.slug, data.name || null, data.email || null, data.phone || null, data.response);

		return {
			id: result.lastInsertRowid,
			...data
		};
	},

	// Get RSVP response by slug
	getBySlug(slug) {
		const stmt = db.prepare("SELECT * FROM rsvp_responses WHERE slug = ?");
		return stmt.get(slug);
	},

	// Get all RSVP responses
	getAll() {
		const stmt = db.prepare("SELECT * FROM rsvp_responses ORDER BY created_at DESC");
		return stmt.all();
	},

	// Get all responses with invitation details
	getAllWithInvitations() {
		const stmt = db.prepare(`
			SELECT 
				r.*,
				i.name as invitation_name,
				i.pronoun as invitation_pronoun
			FROM rsvp_responses r
			LEFT JOIN invitations i ON r.slug = i.slug
			ORDER BY r.created_at DESC
		`);
		return stmt.all();
	}
};

// Backup functionality
const backupDatabase = () => {
	try {
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
		const backupPath = path.join(dataDir, `invitations-backup-${timestamp}.db`);
		
		// Create a backup by copying the database file
		fs.copyFileSync(dbPath, backupPath);
		
		console.log(`Database backup created: ${backupPath}`);
		
		// Optional: Keep only last 30 backups to save space
		const backupFiles = fs.readdirSync(dataDir)
			.filter(file => file.startsWith("invitations-backup-") && file.endsWith(".db"))
			.sort()
			.reverse();
		
		// Delete old backups, keep the most recent 30
		if (backupFiles.length > 30) {
			backupFiles.slice(30).forEach(file => {
				const filePath = path.join(dataDir, file);
				fs.unlinkSync(filePath);
				console.log(`Deleted old backup: ${file}`);
			});
		}
		
		return backupPath;
	} catch (error) {
		console.error("Backup failed:", error);
		throw error;
	}
};

// Schedule daily backup at midnight
cron.schedule("0 0 * * *", () => {
	console.log("Running scheduled database backup...");
	try {
		backupDatabase();
	} catch (err) {
		console.error("Scheduled backup failed:", err);
	}
});

// Run an initial backup on server start
console.log("Initializing database backup system...");
try {
	backupDatabase();
} catch (err) {
	console.error("Initial backup failed:", err);
}

module.exports = { db, invitationDb, rsvpDb, backupDatabase };
