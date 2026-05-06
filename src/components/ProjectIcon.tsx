import { getProjectIconMeta, getProjectIconUrl } from '../constants/projectIcons';

interface ProjectIconProps {
  icon: string;
  alt?: string;
  frameClassName?: string;
  imgClassName?: string;
}

export function ProjectIcon({ icon, alt = '', frameClassName = '', imgClassName = '' }: ProjectIconProps) {
  const meta = getProjectIconMeta(icon);

  return (
    <span className={frameClassName}>
      <img
        src={getProjectIconUrl(icon)}
        alt={alt}
        className={imgClassName}
        style={{ transform: `scale(${meta.scale})`, mixBlendMode: meta.blendMode }}
      />
    </span>
  );
}
