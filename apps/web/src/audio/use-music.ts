import { useEffect } from "react";
import { music, type MusicPlayer } from "./music";
import type { ThemeId } from "./music-themes";

/**
 * Plays a theme while the calling screen is shown. Screens that share a theme
 * hand it over without restarting, because the player ignores a repeat.
 */
export function useMusic(theme: ThemeId | null, player: MusicPlayer = music()) {
  useEffect(() => {
    if (theme) player.play(theme);
  }, [theme, player]);
}
