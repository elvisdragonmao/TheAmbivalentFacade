import { defineConfig } from "vite";

export default defineConfig({
	root: "./frontend",
	base: "/",
	build: {
		outDir: "../public",
		emptyOutDir: true
	},
	server: {
		proxy: {
			"/api": "http://localhost:3000"
		}
	}
});
