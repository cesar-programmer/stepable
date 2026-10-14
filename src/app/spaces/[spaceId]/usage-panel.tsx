import { Icon } from "@/app/components/icons";
import type { UsageSummary } from "@/modules/usage/contract";

const usd = (microUsd: number) =>
  `${(microUsd / 1_000_000).toLocaleString("es", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  })} USD`;

const formatDay = (value: Date) =>
  `${new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value)} UTC`;

/**
 * Compact estimated AI usage for responsibles: today's figure for this space
 * at a glance, details (and limitations) on demand.
 */
export function UsagePanel({ usage }: { usage: UsageSummary }) {
  const ratio =
    usage.spaceDailyMicroUsd > 0
      ? Math.min(1, usage.spaceTodayMicroUsd / usage.spaceDailyMicroUsd)
      : 1;
  const spaceReached = ratio >= 1;
  const blocked = usage.globalExhausted || spaceReached;

  return (
    <details className="card usage-panel" data-testid="ai-usage">
      <summary>
        <span className="usage-panel-title">
          <span className="meta">
            <Icon name="spark" size={18} />
            IA estimada hoy en este espacio
          </span>
          <span className={`badge ${blocked ? "warning" : "success"}`}>
            {usage.globalExhausted
              ? "Presupuesto agotado"
              : spaceReached
                ? "Límite diario alcanzado"
                : "Disponible"}
          </span>
        </span>
        <span className="muted">
          {usd(usage.spaceTodayMicroUsd)} de {usd(usage.spaceDailyMicroUsd)}
        </span>
        <span
          aria-hidden="true"
          className={`progress ${ratio > 0.8 ? "warning" : "brand"}`}
        >
          <span style={{ width: `${Math.round(ratio * 100)}%` }} />
        </span>
      </summary>
      <div className="usage-panel-body">
        <p>
          Consumo de IA registrado desde {formatDay(usage.since)}. Es una
          estimación de Stepable: no es la factura ni el saldo de OpenAI.
        </p>
        <p>
          El límite diario del espacio se restablece a las 00:00 UTC.{" "}
          {usage.globalExhausted
            ? "El presupuesto total del prototipo está agotado: el operador debe ampliarlo."
            : "El presupuesto total del prototipo está disponible."}
        </p>
      </div>
    </details>
  );
}
