import { ICanvasContext2D, IObject, IScreenSizeData } from '@leafer/interface'
import { LeaferCanvasBase } from '@leafer/canvas'
import { Platform } from '@leafer/platform'

export class LeaferCanvas extends LeaferCanvasBase {

    public view: IObject

    public get allowBackgroundColor(): boolean { return false }

    public init(): void {

        this.__createView()
        this.__createContext()

        this.resize(this.config as IScreenSizeData)
    }

    protected __createContext(): void {
        this.context = this.view.getContext('2d') as unknown as ICanvasContext2D
        this.__bindContext()
    }

    protected __createView(): void {
        this.view = Platform.origin.createCanvas(this.width, this.height)
    }

    public updateViewSize(): void {
        const { width, height, pixelRatio } = this

        this.view.width = width * pixelRatio
        this.view.height = height * pixelRatio
    }

}