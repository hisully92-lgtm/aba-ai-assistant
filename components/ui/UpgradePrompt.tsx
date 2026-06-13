import Link from "next/link";

interface UpgradePromptProps {
  reason: string;
  upgradeTo?: string;
  feature?: string;
  inline?: boolean;
}

export default function UpgradePrompt({ reason, upgradeTo, feature, inline = false }: UpgradePromptProps) {
  if (inline) {
    return (
      <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700">
        <span>🔒</span>
        <span>{reason}</span>
        <Link href="/dashboard/settings/billing"
          className="ml-auto shrink-0 bg-orange-500 text-white px-2 py-1 rounded-lg hover:bg-orange-600 transition-colors font-medium">
          Upgrade →
        </Link>
      </div>
    );
  }

  return (
    <div className="border-2 border-dashed border-orange-200 rounded-2xl p-8 text-center bg-orange-50">
      <div className="text-4xl mb-3">🔒</div>
      <p className="font-bold text-gray-800 text-lg mb-2">
        {feature ? `${feature} requires an upgrade` : "Upgrade to unlock this feature"}
      </p>
      <p className="text-sm text-gray-500 mb-6">{reason}</p>
      <Link href="/dashboard/settings/billing"
        className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors">
        View Plans & Upgrade →
      </Link>
      {upgradeTo && (
        <p className="text-xs text-gray-400 mt-3">
          Next plan: <strong className="capitalize">{upgradeTo}</strong>
        </p>
      )}
    </div>
  );
}