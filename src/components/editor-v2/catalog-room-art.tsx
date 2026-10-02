import type { FurnitureRoom } from '@/lib/editor-document/furniture-catalog';

/** Ilustraciones de navegación; no representan un producto ni un render final. */
export function CatalogRoomArt({ room }: { room: FurnitureRoom }) {
  const colors: Record<FurnitureRoom, [string, string, string]> = {
    salon: ['#e9eee6', '#75988a', '#bb936c'], dormitorio: ['#eee8f2', '#a58ab5', '#c9b4a0'],
    cocina: ['#e3edef', '#6a96a2', '#d1b38d'], bano: ['#e1edf2', '#79a8ba', '#e8e3d6'],
    comedor: ['#f5eadc', '#c39462', '#8d9d7b'], oficina: ['#e7eaf4', '#8394bd', '#b49476'],
    exterior: ['#e7eee0', '#829e68', '#bf9c70'], iluminacion: ['#f7edda', '#d8b15c', '#bd9e83'],
    decoracion: ['#f3e4df', '#c68678', '#a9b58b'],
  };
  const [wall, accent, wood] = colors[room];
  return <svg viewBox="0 0 200 140" aria-hidden="true" focusable="false">
    <rect width="200" height="140" rx="12" fill={wall} />
    <path d="M22 103L100 134L181 103L100 73Z" fill={wood} opacity=".4" />
    <path d="M22 103V33L101 12V73Z" fill="white" opacity=".75" />
    <path d="M101 12L181 35V103L101 73Z" fill={accent} opacity=".17" />
    <path d="M122 31L165 43V70L122 58Z" fill="white" opacity=".88" />
    <path d="M143 37V64M122 46L165 58" stroke={accent} strokeWidth="2" opacity=".35" />
    {(room === 'salon' || room === 'exterior') && <>
      <path d="M48 76V60Q49 51 58 54L131 76V103L48 80Z" fill={accent} />
      <path d="M42 75L116 96L139 85V106L115 118L42 94Z" fill={accent} />
      <path d="M53 76L115 95L127 88L65 69Z" fill="white" opacity=".35" />
      <path d="M85 103L115 113L134 105L104 96Z" fill={wood} stroke="white" strokeWidth="2" />
      <path d="M91 106V119M127 108V119" stroke={wood} strokeWidth="3" />
    </>}
    {room === 'dormitorio' && <>
      <path d="M48 69V48L115 67V88Z" fill={accent} />
      <path d="M47 69L113 88L150 105L92 123L43 103Z" fill={wood} />
      <path d="M49 65L112 84L148 103L91 116L46 98Z" fill="white" />
      <path d="M61 76L86 84L101 89L77 92L54 85ZM90 85L112 91L126 98L105 100L87 94Z" fill={wall} />
      <path d="M50 94L91 107L133 96L149 105L92 121L47 105Z" fill={accent} opacity=".8" />
    </>}
    {(room === 'comedor' || room === 'oficina') && <>
      <path d="M63 83V114M131 87V115" stroke={accent} strokeWidth="7" />
      <path d="M43 77L104 60L156 83L93 101Z" fill={wood} />
      <path d="M58 92V109L80 115V101M127 58V72L147 78V65" fill={accent} />
      {room === 'oficina' && <path d="M88 69V47L123 57V80ZM103 77V84" fill={accent} stroke="white" strokeWidth="2" />}
    </>}
    {room === 'cocina' && <>
      <path d="M37 74L98 56L155 75V105L96 88L37 106Z" fill={accent} />
      <path d="M35 72L97 53L159 73L139 83L96 69L38 87Z" fill="white" />
      <path d="M71 82V101M115 76V94M141 84V102" stroke="white" opacity=".5" />
      <path d="M43 39L85 27V49L43 61Z" fill={wood} />
      <ellipse cx="110" cy="67" rx="11" ry="4" fill={accent} opacity=".5" />
    </>}
    {room === 'bano' && <>
      <path d="M39 88Q35 73 49 72L145 92Q163 99 146 110L104 122Q95 125 85 119Z" fill="white" />
      <path d="M51 81L139 99L106 111Z" fill={accent} opacity=".25" />
      <path d="M56 78V64Q56 54 67 61" fill="none" stroke={accent} strokeWidth="4" />
      <ellipse cx="63" cy="46" rx="16" ry="21" fill={accent} opacity=".25" />
    </>}
    {room === 'iluminacion' && <>
      <path d="M95 49V115M78 115H113" stroke={wood} strokeWidth="5" />
      <path d="M79 44H111L128 74Q97 86 62 74Z" fill={accent} />
      <ellipse cx="95" cy="76" rx="31" ry="7" fill="#fff8d9" />
    </>}
    {(room === 'decoracion' || room === 'exterior') && <>
      <path d="M142 87H169L164 117H147Z" fill={wood} />
      <path d="M156 92V53M156 76Q130 74 133 51Q153 51 156 76M156 66Q161 42 178 46Q181 67 156 77" fill={accent} stroke={accent} strokeWidth="3" />
      {room === 'decoracion' && <ellipse cx="82" cy="104" rx="35" ry="13" fill={accent} opacity=".4" />}
    </>}
  </svg>;
}
