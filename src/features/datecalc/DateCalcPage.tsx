import { useTranslation } from "react-i18next";

import { DateCalcIcon } from "../../components/layout/icons";
import { PagePlaceholder } from "../shared/PagePlaceholder";

export function DateCalcPage() {
  const { t } = useTranslation();
  return <PagePlaceholder title={t("date:title")} icon={<DateCalcIcon size={28} />} />;
}
