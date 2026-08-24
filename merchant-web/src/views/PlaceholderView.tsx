import EmptyState from '../components/EmptyState';

interface PlaceholderViewProps {
  title: string;
}

export default function PlaceholderView({ title }: PlaceholderViewProps) {
  return (
    <div className="placeholder-view">
      <h2>{title}</h2>
      <EmptyState title="该页面为框架占位页" desc="功能模块接入后可替换为真实页面" />
    </div>
  );
}
