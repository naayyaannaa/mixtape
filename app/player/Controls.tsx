import PixelIcon from "../components/PixelIcon";
import type { Repeat } from "./PlaybackProvider";

/** Previous / play-pause / next buttons, optionally with shuffle and repeat on the sides. */
export default function Controls({
  paused,
  onPrevious,
  onPlayPause,
  onNext,
  shuffle,
  onShuffle,
  repeat,
  onRepeat,
  size,
  className,
}: {
  paused: boolean;
  onPrevious: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  shuffle?: boolean;
  onShuffle?: () => void;
  repeat?: Repeat;
  onRepeat?: () => void;
  /** Height of the previous/next icons; play/pause is 30% bigger, shuffle/repeat 60%. */
  size: number;
  className?: string;
}) {
  const btn = "transition-transform active:scale-90";
  // Toggles: dimmed when off, full strength when on.
  const toggle = (on: boolean) => `${btn} transition-opacity ${on ? "opacity-100" : "opacity-40 hover:opacity-70"}`;
  const small = Math.round(size * 0.6);
  return (
    <div className={`flex items-center ${className ?? ""}`}>
      {onShuffle && (
        <button
          aria-label="Shuffle"
          aria-pressed={!!shuffle}
          onClick={onShuffle}
          className={toggle(!!shuffle)}
        >
          <PixelIcon name="shuffle" size={small} />
        </button>
      )}
      <button aria-label="Previous track" onClick={onPrevious} className={btn}>
        <PixelIcon name="previous" size={size} />
      </button>
      <button aria-label={paused ? "Play" : "Pause"} onClick={onPlayPause} className={btn}>
        <PixelIcon name={paused ? "play" : "pause"} size={Math.round(size * 1.3)} />
      </button>
      <button aria-label="Next track" onClick={onNext} className={btn}>
        <PixelIcon name="next" size={size} />
      </button>
      {onRepeat && (
        <button
          aria-label={
            repeat === "track" ? "Repeat: this song" : repeat === "context" ? "Repeat: playlist" : "Repeat: off"
          }
          onClick={onRepeat}
          className={`relative ${toggle(repeat !== "off")}`}
        >
          <PixelIcon name="repeat" size={small} />
          {/* Repeat-one: a small 1 on the loop, like most players. */}
          {repeat === "track" && (
            <span className="absolute -right-2 -top-3 text-sm leading-none">1</span>
          )}
        </button>
      )}
    </div>
  );
}
