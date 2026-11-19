import { useTranslation } from "react-i18next";

import { BasicIcon } from "../../components/layout/icons";
import { PagePlaceholder } from "../shared/PagePlaceholder";

export function BasicPage() {
  const { t } = useTranslation();
  return <PagePlaceholder title={t("basic:title")} icon={<BasicIcon size={28} />} />;
}
