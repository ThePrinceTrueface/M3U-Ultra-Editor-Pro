
export type StreamCategory = 'TV' | 'Movie' | 'Series' | 'Other';

export interface M3UItem {
  id: string;
  name: string;
  url: string;
  group: string;
  logo: string;
  tvgId: string;
  category: StreamCategory;
  status: 'unknown' | 'online' | 'offline' | 'checking';
  rawAttributes: Record<string, string>;
}

export interface PlaylistStats {
  total: number;
  online: number;
  offline: number;
  groups: number;
  duplicates: number;
  tvCount: number;
  movieCount: number;
  seriesCount: number;
}

export enum SortOption {
  NAME_ASC = 'Name (A-Z)',
  NAME_DESC = 'Name (Z-A)',
  GROUP_ASC = 'Group (A-Z)',
  URL_ASC = 'URL (A-Z)'
}
