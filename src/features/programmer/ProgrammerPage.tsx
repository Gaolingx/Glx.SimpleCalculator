import { useTranslation } from "react-i18next";

import { ProgrammerIcon } from "../../components/layout/icons";
import { PagePlaceholder } from "../shared/PagePlaceholder";

export function ProgrammerPage() {
  const { t } = useTranslation();
  return (
    <PagePlaceholder title={t("programmer:title")} icon={<ProgrammerIcon size={28} />} />
  );
}
