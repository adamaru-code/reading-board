// ネイティブ BarcodeDetector API の最小型宣言（TS の DOM lib に未収録のため）
interface BarcodeDetectorOptions {
  formats?: string[]
}

interface DetectedBarcode {
  rawValue: string
  format: string
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions)
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}

interface Window {
  BarcodeDetector?: typeof BarcodeDetector
}
