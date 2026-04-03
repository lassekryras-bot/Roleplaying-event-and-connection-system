import "./styles.css";

export function Skeleton({ height = 16 }: { height?: number }) {
  return <div className="ui-skeleton" style={{ height }} aria-hidden="true" />;
}
