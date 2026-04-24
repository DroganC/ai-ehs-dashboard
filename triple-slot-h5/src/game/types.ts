export type TileType = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

export type Tile = {
  id: string
  type: TileType
  icon: string
  row: number
  col: number
  state: 'onBoard' | 'picking' | 'inSlot' | 'cleared'
}

export type Pick = {
  tileId: string
  type: TileType
  icon: string
  row: number
  col: number
}

