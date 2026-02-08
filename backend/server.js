require("dotenv").config();
const fastify = require("fastify")({ logger: true });
const path = require("path");
const { invitationDb, rsvpDb } = require("./database");

fastify.register(require("@fastify/cookie"));
fastify.register(require("@fastify/formbody"));
fastify.register(require("@fastify/static"), {
	root: path.join(__dirname, "../public"),
	prefix: "/"
});

const requireAuth = async (request, reply) => {
	const token = request.cookies.admin_token;
	if (token !== process.env.SESSION_SECRET) {
		return reply.code(401).send({ error: "Unauthorized" });
	}
};

fastify.get("/api/invitation/:slug", async (request, reply) => {
	const invitation = invitationDb.getBySlug(request.params.slug);
	if (!invitation) {
		return reply.code(404).send({ error: "Invitation not found" });
	}
	return reply.send(invitation);
});

fastify.post("/api/admin/login", async (request, reply) => {
	const { password } = request.body;

	if (password === process.env.ADMIN_PASSWORD) {
		reply.setCookie("admin_token", process.env.SESSION_SECRET, {
			path: "/",
			httpOnly: true,
			maxAge: 86400 // 24 hours
		});
		return reply.send({ success: true });
	}

	return reply.code(401).send({ error: "Invalid password" });
});

fastify.post("/api/admin/logout", async (request, reply) => {
	reply.clearCookie("admin_token");
	return reply.send({ success: true });
});

fastify.get("/api/invitations", { preHandler: requireAuth }, async (request, reply) => {
	const query = request.query.search;
	const invitations = query ? invitationDb.search(query) : invitationDb.getAll();
	return reply.send(invitations);
});

fastify.get("/api/invitations/:id", { preHandler: requireAuth }, async (request, reply) => {
	const invitation = invitationDb.getById(request.params.id);
	if (!invitation) {
		return reply.code(404).send({ error: "Invitation not found" });
	}
	return reply.send(invitation);
});

fastify.post("/api/invitations", { preHandler: requireAuth }, async (request, reply) => {
	try {
		const { name, pronoun, message, slug, inviteToParty } = request.body;

		if (!name || !pronoun || !message) {
			return reply.code(400).send({ error: "Name, pronoun, and message are required" });
		}

		const invitation = invitationDb.create({ name, pronoun, message, slug: slug || "", inviteToParty });
		return reply.code(201).send(invitation);
	} catch (error) {
		return reply.code(400).send({ error: error.message });
	}
});

fastify.put("/api/invitations/:id", { preHandler: requireAuth }, async (request, reply) => {
	try {
		const { name, pronoun, message, slug, inviteToParty } = request.body;

		if (!name || !message || !slug) {
			return reply.code(400).send({ error: "請填寫名稱、訊息和代碼" });
		}

		const success = invitationDb.update(request.params.id, { name, pronoun, message, slug, inviteToParty });

		if (!success) {
			return reply.code(404).send({ error: "Invitation not found" });
		}

		return reply.send({ success: true });
	} catch (error) {
		return reply.code(400).send({ error: error.message });
	}
});

fastify.delete("/api/invitations/:id", { preHandler: requireAuth }, async (request, reply) => {
	const success = invitationDb.delete(request.params.id);

	if (!success) {
		return reply.code(404).send({ error: "Invitation not found" });
	}

	return reply.send({ success: true });
});

// RSVP endpoints
fastify.post("/api/rsvp", async (request, reply) => {
	try {
		const { slug, name, email, phone, response } = request.body;

		if (!slug || !response) {
			return reply.code(400).send({ error: "Slug and response are required" });
		}

		// Verify that the invitation exists
		const invitation = invitationDb.getBySlug(slug);
		if (!invitation) {
			return reply.code(404).send({ error: "Invitation not found" });
		}

		const rsvp = rsvpDb.submitResponse({ slug, name, email, phone, response });
		return reply.send({ success: true, rsvp });
	} catch (error) {
		return reply.code(400).send({ error: error.message });
	}
});

fastify.get("/api/rsvp/:slug", async (request, reply) => {
	const rsvp = rsvpDb.getBySlug(request.params.slug);
	if (!rsvp) {
		return reply.code(404).send({ error: "RSVP not found" });
	}
	return reply.send(rsvp);
});

fastify.get("/api/rsvps", { preHandler: requireAuth }, async (request, reply) => {
	const rsvps = rsvpDb.getAllWithInvitations();
	return reply.send(rsvps);
});

fastify.setNotFoundHandler((request, reply) => {
	if (request.url.startsWith("/api/")) return reply.code(404).send({ error: "API endpoint not found" });
	return reply.code(404).type("text/html").sendFile("404.html");
});

const start = async () => {
	try {
		const port = process.env.PORT || 3000;
		const host = process.env.HOST || "0.0.0.0";
		await fastify.listen({ port, host });
		console.log(`Server running at http://${host}:${port}`);
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
};

start();
