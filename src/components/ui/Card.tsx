// Card: flat bordered surface; link and button variants get a hover state (spec R1.4).
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes } from "react";
import s from "./kv.module.css";

type Tone = "plain" | "next" | "inverse";
type CardProps =
  | ({ as?: "div"; tone?: Tone } & HTMLAttributes<HTMLDivElement>)
  | ({ as: "a"; tone?: Tone } & AnchorHTMLAttributes<HTMLAnchorElement>)
  | ({ as: "button"; tone?: Tone } & ButtonHTMLAttributes<HTMLButtonElement>);

export function Card(props: CardProps) {
  const { as = "div", tone = "plain", className, ...rest } = props;
  const clickable = as !== "div";
  const classes = [s.card, tone === "plain" ? "" : s[tone], clickable ? `${s.clickable} ${s.pressable} ${s.focusable}` : "", className ?? ""].filter(Boolean).join(" ");
  if (as === "a") return <a {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} className={classes} />;
  if (as === "button") return <button type="button" {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)} className={classes} />;
  return <div {...(rest as HTMLAttributes<HTMLDivElement>)} className={classes} />;
}
