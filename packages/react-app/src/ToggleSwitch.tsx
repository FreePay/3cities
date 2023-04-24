import React, { useCallback, useState } from "react";
import { FaToggleOn, FaToggleOff } from "react-icons/fa";

interface ToggleSwitchProps {
  offLabel?: string;
  onLabel?: string;
  initialIsOn: boolean;
  onToggle: (isOn: boolean) => void;
  whichDirectionIsOn?: "left" | "right";
  onClassName?: string;
  offClassName?: string;
  size?: string;
}

const styleFlipHorizontally = { transform: "scaleX(-1)" };

export const ToggleSwitch: React.FC<ToggleSwitchProps> = React.memo(({
  offLabel,
  onLabel,
  initialIsOn,
  onToggle,
  whichDirectionIsOn = "right",
  onClassName = "text-green-500",
  offClassName = "text-red-500",
  size = "1.5em",
}: ToggleSwitchProps) => {
  const [isOn, setIsOn] = useState(initialIsOn);

  const handleToggle = useCallback(() => {
    const newState = !isOn;
    setIsOn(newState);
    onToggle(newState);
  }, [isOn, setIsOn, onToggle]);

  const iconStyle = whichDirectionIsOn === "left" ? styleFlipHorizontally : {};
  const leftLabel = whichDirectionIsOn === "left" ? onLabel : offLabel;
  const rightLabel = whichDirectionIsOn === "right" ? onLabel : offLabel;

  return (
    <div className="flex items-center gap-2">
      {leftLabel && <span>{leftLabel}</span>}
      <button onClick={handleToggle} className={`focus:outline-none transition-colors duration-150 active:scale-95 ${isOn ? onClassName : offClassName}`}>
        {/* NB here we apply onClassName and offClassName to the button instead of directly to FaToggleOn/FaToggleOff so that the default transition-colors is correctly applied. Otherwise, transition-colors doesn't work because it only affects changing the color on the same element, and FaToggleOn/Off are two different elements. */}
        {isOn ? <FaToggleOn size={size} style={iconStyle} /> : <FaToggleOff size={size} style={iconStyle} />}
      </button>
      {rightLabel && <span>{rightLabel}</span>}
    </div>
  );
});

ToggleSwitch.displayName = "ToggleSwitch";
