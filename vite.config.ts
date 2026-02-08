import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
	root: "./frontend",
	base: "/",
	build: {
		outDir: "../public",
		emptyOutDir: true,
		rollupOptions: {
			input: {
				main: resolve(__dirname, "frontend/index.html"),
				admin: resolve(__dirname, "frontend/admin/index.html"),
				login: resolve(__dirname, "frontend/login/index.html"),
				notfound: resolve(__dirname, "frontend/404.html")
			}
		}
	},
	server: {
		proxy: {
			"/api": "http://localhost:3000"
		}
	}
});
