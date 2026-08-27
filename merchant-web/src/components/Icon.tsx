import homeSvg from '../assets/svg/nav-home.svg?raw';
import restaurantSvg from '../assets/svg/nav-restaurant.svg?raw';
import dishSvg from '../assets/svg/nav-dish.svg?raw';
import archiveSvg from '../assets/svg/nav-archive.svg?raw';
import settingsSvg from '../assets/svg/nav-settings.svg?raw';
import reportSvg from '../assets/svg/nav-report.svg?raw';
import revenueSvg from '../assets/svg/nav-revenue.svg?raw';
import dishSalesSvg from '../assets/svg/nav-dish-sales.svg?raw';
import ordersSvg from '../assets/svg/nav-orders.svg?raw';
import incomeSvg from '../assets/svg/nav-income.svg?raw';
import searchSvg from '../assets/svg/search.svg?raw';
import emptySvg from '../assets/svg/empty.svg?raw';
import brandAuthSvg from '../assets/svg/brand-auth.svg?raw';
import iconPhoneSvg from '../assets/svg/icon-phone.svg?raw';
import iconLockSvg from '../assets/svg/icon-lock.svg?raw';
import iconEyeSvg from '../assets/svg/icon-eye.svg?raw';
import iconEyeOffSvg from '../assets/svg/icon-eye-off.svg?raw';
import iconWarnSvg from '../assets/svg/icon-warn.svg?raw';
import refreshSvg from '../assets/svg/refresh.svg?raw';
import exportSvg from '../assets/svg/export.svg?raw';
import themeSunSvg from '../assets/svg/theme-sun.svg?raw';
import themeMoonSvg from '../assets/svg/theme-moon.svg?raw';
import starSvg from '../assets/svg/star.svg?raw';
import starFilledSvg from '../assets/svg/star-filled.svg?raw';

const ICONS: Record<string, string> = {
  'nav-home': homeSvg,
  'nav-restaurant': restaurantSvg,
  'nav-dish': dishSvg,
  'nav-archive': archiveSvg,
  'nav-settings': settingsSvg,
  'nav-report': reportSvg,
  'nav-revenue': revenueSvg,
  'nav-dish-sales': dishSalesSvg,
  'nav-orders': ordersSvg,
  'nav-income': incomeSvg,
  search: searchSvg,
  empty: emptySvg,
  'brand-auth': brandAuthSvg,
  'icon-phone': iconPhoneSvg,
  'icon-lock': iconLockSvg,
  'icon-eye': iconEyeSvg,
  'icon-eye-off': iconEyeOffSvg,
  'icon-warn': iconWarnSvg,
  refresh: refreshSvg,
  'theme-sun': themeSunSvg,
  'theme-moon': themeMoonSvg,
  export: exportSvg,
  star: starSvg,
  'star-filled': starFilledSvg,
};

export interface IconProps {
  name: string;
  className?: string;
}

export default function Icon({ name, className }: IconProps) {
  const svg = ICONS[name] ?? '';
  return (
    <span
      className={`icon ${className ?? ''}`.trim()}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
