import { useTranslation } from "react-i18next";

import { ConverterIcon } from "../../components/layout/icons";
import { PagePlaceholder } from "../shared/PagePlaceholder";

export function ConverterPage() {
  const { t } = useTranslation();
  return <PagePlaceholder title={t("units:title")} icon={<ConverterIcon size={28} />} />;
}
