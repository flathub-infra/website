// Highlight the painted cell/segment rather than its endpoint or center.
export const rectangleFocusStates = [
  {
    when: { focus: "primary" },
    style: { stroke: "currentColor", strokeWidth: 2 },
  },
] as const
