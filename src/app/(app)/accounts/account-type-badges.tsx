import { Badge } from "@/components/ui/badge";
import { ACCOUNT_TYPE_LABELS, type AccountType } from "@/domain/accounts/account-types";

export function AccountTypeBadges({ types }: { types: AccountType[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {types.map((type) => (
        <Badge key={type} variant="secondary">
          {ACCOUNT_TYPE_LABELS[type]}
        </Badge>
      ))}
    </span>
  );
}
