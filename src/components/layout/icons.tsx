import type { SVGProps } from "react";

export type AppIconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  size?: number;
};

function Svg({ size = 20, ...rest }: AppIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    />
  );
}

export function BasicIcon(props: AppIconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <path d="M8 8.5h.01M12 8.5h.01M16 8.5h.01M8 12h.01M12 12h.01M16 12h.01M8 15.5h4M16 15.5h.01" />
    </Svg>
  );
}

export function ScientificIcon(props: AppIconProps) {
  return (
    <Svg {...props}>
      <path d="M4 13.5l3 4 4.5-11h8" />
      <path d="M16 16.5h4M18 14.5v4" />
    </Svg>
  );
}

export function ProgrammerIcon(props: AppIconProps) {
  return (
    <Svg {...props}>
      <path d="M9 8l-4 4 4 4M15 8l4 4-4 4M13.5 5.5l-3 13" />
    </Svg>
  );
}

export function StatisticsIcon(props: AppIconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20h16" />
      <path d="M7 20v-6M12 20V7M17 20v-9" />
    </Svg>
  );
}

export function DateCalcIcon(props: AppIconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" />
    </Svg>
  );
}

export function ConverterIcon(props: AppIconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8.5h14.5M15.5 5.5l3 3-3 3" />
      <path d="M20 15.5H5.5M8.5 12.5l-3 3 3 3" />
    </Svg>
  );
}

export function SwapIcon(props: AppIconProps) {
  return (
    <Svg {...props}>
      <path d="M8 4.5v15M8 19.5l-3-3M8 19.5l3-3" />
      <path d="M16 19.5v-15M16 4.5l-3 3M16 4.5l3 3" />
    </Svg>
  );
}

export function WorksheetsIcon(props: AppIconProps) {
  return (
    <Svg {...props}>
      <path d="M7 3.5h7l4 4V20a.5.5 0 01-.5.5h-10A.5.5 0 017 20V4a.5.5 0 01.5-.5z" />
      <path d="M14 3.5v4h4M9.5 12h5M9.5 15.5h5" />
    </Svg>
  );
}

export function HistoryIcon(props: AppIconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 12a7.5 7.5 0 107.5-7.5c-2.2 0-4.1.9-5.5 2.4" />
      <path d="M4.5 5v3.5H8M12 8v4.5l3 1.8" />
    </Svg>
  );
}

export function CopyIcon(props: AppIconProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M15 6.5V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2h.5" />
    </Svg>
  );
}

export function TrashIcon(props: AppIconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 6.5h15M9.5 4h5M7 6.5l.8 12a1.5 1.5 0 001.5 1.4h5.4a1.5 1.5 0 001.5-1.4l.8-12" />
      <path d="M10.5 10.5v5M13.5 10.5v5" />
    </Svg>
  );
}

export function SettingsIcon(props: AppIconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </Svg>
  );
}

export function MinimizeIcon(props: AppIconProps) {
  return (
    <Svg {...props}>
      <path d="M6 12h12" />
    </Svg>
  );
}

export function MaximizeIcon(props: AppIconProps) {
  return (
    <Svg {...props}>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </Svg>
  );
}

export function RestoreIcon(props: AppIconProps) {
  return (
    <Svg {...props}>
      <rect x="8" y="8" width="10" height="10" rx="1.5" />
      <path d="M6 15.5V7.5A1.5 1.5 0 017.5 6h8" />
    </Svg>
  );
}

export function CloseIcon(props: AppIconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </Svg>
  );
}
