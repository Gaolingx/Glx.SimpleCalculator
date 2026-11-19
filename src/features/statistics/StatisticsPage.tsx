import { useTranslation } from "react-i18next";

import { StatisticsIcon } from "../../components/layout/icons";
import { PagePlaceholder } from "../shared/PagePlaceholder";

export function StatisticsPage() {
  const { t } = useTranslation();
  return (
    <PagePlaceholder title={t("statistics:title")} icon={<StatisticsIcon size={28} />} />
  );
}
