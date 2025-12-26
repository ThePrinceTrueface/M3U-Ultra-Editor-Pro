
import { M3UItem } from '../types';

const workerCode = `
  self.onmessage = function(e) {
    const content = e.data;
    const lines = content.split('\\n');
    const items = [];
    let currentItem = null;

    function generateId() {
      try {
        return crypto.randomUUID();
      } catch (e) {
        return 'id-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
      }
    }

    function detectCategory(url, group, name) {
      const lowerUrl = (url || '').toLowerCase();
      const lowerGroup = (group || '').toLowerCase();
      const lowerName = (name || '').toLowerCase();

      if (lowerUrl.includes('/movie/')) return 'Movie';
      if (lowerUrl.includes('/series/')) return 'Series';
      if (lowerUrl.includes('/live/')) return 'TV';

      if (lowerGroup.includes('film') || lowerGroup.includes('movie') || lowerGroup.includes('vod')) return 'Movie';
      if (lowerGroup.includes('serie') || lowerGroup.includes('season') || lowerGroup.includes('saison')) return 'Series';
      
      const ext = lowerUrl.split('.').pop()?.split('?')[0];
      if (['mp4', 'mkv', 'avi'].includes(ext)) return 'Movie';
      if (['ts', 'm3u8'].includes(ext)) return 'TV';

      return 'TV';
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('#EXTINF:')) {
        const infoPart = line.substring(8);
        const nameMatch = infoPart.match(/,(.*)$/);
        const name = nameMatch ? nameMatch[1].trim() : 'Unnamed Stream';

        const attributes = {};
        const attrMatches = infoPart.matchAll(/([a-zA-Z0-9-]+)="([^"]*)"/g);
        for (const match of attrMatches) {
          attributes[match[1]] = match[2];
        }

        currentItem = {
          id: generateId(),
          name,
          group: attributes['group-title'] || 'Uncategorized',
          logo: attributes['tvg-logo'] || '',
          tvgId: attributes['tvg-id'] || '',
          status: 'unknown',
          rawAttributes: attributes
        };
      } else if (!line.startsWith('#')) {
        if (currentItem) {
          currentItem.url = line;
          currentItem.category = detectCategory(line, currentItem.group, currentItem.name);
          items.push(currentItem);
          currentItem = null;
        }
      }
      
      if (i % 5000 === 0) {
        self.postMessage({ type: 'progress', percent: Math.round((i / lines.length) * 100) });
      }
    }
    self.postMessage({ type: 'complete', items });
  };
`;

export const parseM3UAsync = (content: string): Promise<M3UItem[]> => {
  return new Promise((resolve, reject) => {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    worker.onmessage = (e) => {
      if (e.data.type === 'complete') {
        resolve(e.data.items);
        worker.terminate();
      }
    };

    worker.onerror = (err) => {
      reject(err);
      worker.terminate();
    };

    worker.postMessage(content);
  });
};

export const generateM3U = (items: M3UItem[]): string => {
  let content = '#EXTM3U\n';
  items.forEach(item => {
    let extinf = `#EXTINF:-1 tvg-id="${item.tvgId}" tvg-logo="${item.logo}" group-title="${item.group}"`;
    Object.entries(item.rawAttributes).forEach(([key, value]) => {
      if (!['tvg-id', 'tvg-logo', 'group-title'].includes(key)) {
        extinf += ` ${key}="${value}"`;
      }
    });
    content += `${extinf},${item.name}\n${item.url}\n`;
  });
  return content;
};
