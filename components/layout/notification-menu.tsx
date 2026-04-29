import { Button } from "@/components/ui/button";
import { markAllNotificationsReadAction } from "@/components/layout/notification-actions";

type NotificationMenuProps = {
  unreadCount: number;
};

export function NotificationMenu({ unreadCount }: NotificationMenuProps) {
  const label =
    unreadCount === 0
      ? "Sin notificaciones nuevas"
      : `${unreadCount} notificacion${unreadCount === 1 ? "" : "es"} sin leer`;

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      {unreadCount > 0 ? (
        <form action={markAllNotificationsReadAction}>
          <Button size="sm" type="submit" variant="outline">
            Marcar leidas
          </Button>
        </form>
      ) : null}
    </div>
  );
}
