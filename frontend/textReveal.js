import gsap from "gsap";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(SplitText);

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const CJK = /[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}\u{2a700}-\u{2ebef}\uf900-\ufaff]/gu;
const ZWSP = "\u200B";

/* ---------- split helpers ---------- */

function hasBr(el) {
	return el.innerHTML.includes("<br");
}

function splitByBr(el) {
	if (el.dataset.split) return;

	const lines = el.innerHTML.split(/<br[^>]*\/?>/gi).filter(l => l.trim());

	const wrapper = document.createElement("div");
	wrapper.className = "text-reveal-wrapper";

	lines.forEach(html => {
		const line = document.createElement("div");
		line.className = "text-reveal-line";

		const span = document.createElement("span");
		span.className = "text-reveal-content";
		span.innerHTML = html;

		line.appendChild(span);
		wrapper.appendChild(line);
	});

	el.innerHTML = "";
	el.appendChild(wrapper);
	el.dataset.split = "1";
}

function splitLines(el) {
	if (el.dataset.split) return;

	if (hasBr(el)) {
		splitByBr(el);
		return;
	}

	SplitText.create(el, {
		type: "lines",
		mask: "lines",
		prepareText: t => t.replace(CJK, m => m + ZWSP),
		wordDelimiter: ZWSP,
		linesClass: "text-reveal-content"
	});

	el.dataset.split = "1";
}

/* ---------- animation ---------- */

function setHidden(lines, skew) {
	gsap.set(lines, {
		y: "100%",
		opacity: 0,
		skewY: skew
	});
}

function setVisible(lines) {
	gsap.set(lines, {
		y: "0%",
		opacity: 1,
		skewY: 0
	});
}

export function playReveal(el, opts) {
	splitLines(el);

	const lines = el.querySelectorAll(".text-reveal-content");
	if (!lines.length) return;

	if (prefersReducedMotion) {
		gsap.set(lines, { y: 0, opacity: 1, skewY: 0 });
		return;
	}

	gsap.to(lines, {
		y: "0%",
		opacity: 1,
		skewY: 0,
		duration: opts.duration,
		ease: opts.ease,
		stagger: { amount: opts.stagger }
	});
}

export function resetReveal(el, opts) {
	const lines = el.querySelectorAll(".text-reveal-content");
	if (!lines.length) return;

	if (prefersReducedMotion) {
		gsap.set(lines, { y: 0, opacity: 1 });
		return;
	}

	gsap.set(lines, {
		y: "100%",
		opacity: 0,
		skewY: opts.skew
	});
}
