import type { Preview } from "@storybook/react";
import "../src/components/ui/styles.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: { expanded: true },
  },
};

export default preview;
