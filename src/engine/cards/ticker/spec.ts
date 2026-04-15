import { TickerCardComponent, type TickerCardData } from "./component";
import type { CardSpec } from "../types";

export const cardSpec = {
  type: "ticker",
  title: "Ticker",
  description: "Large-format kinetic text card for slogans, takeaways, and short punchlines.",
  schemaVersion: 1,
  defaults: {
    scale: 1,
    style: "flash",
  } satisfies Partial<TickerCardData>,
  component: TickerCardComponent,
  agentHints: {
    whenToUse: "Use for short emphatic phrases, section bumpers, and memorable declarations.",
    notForUseCases: "Not for paragraphs, tables, or anything that needs detailed scanning.",
    exampleData: {
      content: "Content as Code\nShip One Story\nEverywhere",
      style: "kinetic",
    },
  },
  status: "active",
} satisfies CardSpec<TickerCardData>;
