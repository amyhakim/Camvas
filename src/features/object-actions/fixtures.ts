import type { ObjectAction } from './types';
export function createObjectActionFixtures(onSelect: (id: string) => void): ObjectAction[] {
  return [
    { id: 'frame', label: 'Frame object', onSelect: () => onSelect('frame') },
    { id: 'duplicate', label: 'Duplicate', onSelect: () => onSelect('duplicate') },
    { id: 'rename', label: 'Rename', onSelect: () => onSelect('rename') },
    { id: 'delete', label: 'Delete', danger: true, onSelect: () => onSelect('delete') },
  ];
}
