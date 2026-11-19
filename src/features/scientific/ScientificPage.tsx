import { useTranslation } from "react-i18next";

import { ScientificIcon } from "../../components/layout/icons";
import { PagePlaceholder } from "../shared/PagePlaceholder";

export function ScientificPage() {
  const { t } = useTranslation();
  return (
    <PagePlaceholder title={t("scientific:title")} icon={<ScientificIcon size={28} />} />
  );
}
