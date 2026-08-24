import Icon from './Icon';

export interface EmptyStateProps {
  title: string;
  desc?: string;
}

export default function EmptyState({ title, desc }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Icon name="empty" className="empty-icon" />
      <div className="empty-title">{title}</div>
      {desc && <div className="empty-desc">{desc}</div>}
    </div>
  );
}
