import React, { useCallback, useState } from "react";
import { FaToggleOff, FaToggleOn } from "react-icons/fa";

// TODO ability to set Toggle.isOn programmatically. Perhaps this should work more similar to useInputs where the toggle isOn state is (optionally) owned by the client.

interface ToggleSwitchProps {
  offLabel?: string; // label to show on the "off" side of the switch.
  onLabel?: string; // label to show on the "on" side of the switch.
  initialIsOn: boolean; // iff true, switch will be toggled on initially.
  onToggle: (isOn: boolean) => void; // callback to receive updated isOn status when switch is toggled.
  whichDirectionIsOn?: "left" | "right"; // whether or not the switch's "on" side is left or right. Default right.
  className?: string; // className to apply to root element.
  onClassName?: string; // className to apply to the non-root button when toggled on. Typically used to set the color when toggled on. Defaults to text-green-500.
  offClassName?: string; // className to apply to the non-root button when toggled off. Typically used to set the color when toggled off. Defaults to text-red-500.
  size?: string; // size of the toggle. Defaults to 1.5em.
}

const styleFlipHorizontally = { transform: "scaleX(-1)" };

export const ToggleSwitch: React.FC<ToggleSwitchProps> = React.memo(({
  offLabel,
  onLabel,
  initialIsOn,
  onToggle,
  whichDirectionIsOn = "right",
  className,
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
    <div onClick={handleToggle} className={`flex items-center ${className || ''}`}>
      {leftLabel && <span>{leftLabel}</span>}
      <button className={`focus:outline-none transition-colors duration-150 active:scale-95 ${isOn ? onClassName : offClassName}`}>
        {/* NB here we apply onClassName and offClassName to the button instead of directly to FaToggleOn/FaToggleOff so that the default transition-colors is correctly applied. Otherwise, transition-colors doesn't work because it only affects changing the color on the same element, and FaToggleOn/Off are two different elements. */}
        {isOn ? <FaToggleOn size={size} style={iconStyle} /> : <FaToggleOff size={size} style={iconStyle} />}
      </button>
      {rightLabel && <span>{rightLabel}</span>}
    </div>
  );
});

ToggleSwitch.displayName = "ToggleSwitch";
