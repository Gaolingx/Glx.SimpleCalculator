import { useTranslation } from "react-i18next";

import { WorksheetsIcon } from "../../components/layout/icons";
import { PagePlaceholder } from "../shared/PagePlaceholder";

export function WorksheetsPage() {
  const { t } = useTranslation();
  return <PagePlaceholder title={t("worksheets:title")} icon={<WorksheetsIcon size={28} />} />;
}
