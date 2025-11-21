import { type RefObject, useEffect } from "react";

/**
 * Custom hook that adds Cmd+K (Mac) or Ctrl+K (Windows/Linux) keyboard shortcut
 * to focus a search input element.
 *
 * @param searchInputRef - React ref pointing to the search input element
 *
 * @example
 * ```tsx
 * const searchInputRef = useRef<HTMLInputElement>(null);
 * useSearchShortcut(searchInputRef);
 *
 * return <input ref={searchInputRef} placeholder="Search..." />;
 * ```
 */
export function useSearchShortcut(
	searchInputRef: RefObject<HTMLInputElement>,
) {
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			// Check if Cmd+K (Mac) or Ctrl+K (Windows/Linux) was pressed
			const isShortcut = (event.metaKey || event.ctrlKey) && event.key === "k";

			if (!isShortcut) return;

			// Don't trigger if user is already typing in an input field
			const activeElement = document.activeElement;
			const isTyping =
				activeElement instanceof HTMLInputElement ||
				activeElement instanceof HTMLTextAreaElement ||
				activeElement instanceof HTMLSelectElement ||
				activeElement?.hasAttribute("contenteditable");

			if (isTyping) return;

			// Prevent browser's default Cmd+K behavior (e.g., address bar focus)
			event.preventDefault();

			// Focus the search input
			searchInputRef.current?.focus();
		};

		// Attach event listener
		document.addEventListener("keydown", handleKeyDown);

		// Cleanup on unmount
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [searchInputRef]);
}
