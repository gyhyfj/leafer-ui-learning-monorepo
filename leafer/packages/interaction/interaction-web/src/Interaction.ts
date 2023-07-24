import { IObject, IPointData, ITimer } from '@leafer/interface'
import { InteractionBase, InteractionHelper } from '@leafer/interaction'
import { MathHelper } from '@leafer/math'
import { Keyboard } from '@leafer/event-ui'

import { PointerEventHelper } from './PointerEventHelper'
import { MutiTouchHelper } from './MutiTouchHelper'
import { WheelEventHelper } from './WheelEventHelper'


interface IClientPoint {
    clientX: number
    clientY: number
}

interface IGestureEvent extends IClientPoint, UIEvent {
    scale: number
    rotation: number
    preventDefault(): void
}


const { getMoveEventData, getZoomEventData, getRotateEventData } = InteractionHelper

export class Interaction extends InteractionBase {

    protected view: HTMLElement

    protected viewEvents: IObject
    protected windowEvents: IObject

    protected usePointer: boolean
    protected useMutiTouch: boolean
    protected useTouch: boolean

    protected touchTimer: ITimer
    protected touches?: Touch[]
    protected lastGestureScale: number
    protected lastGestureRotation: number

    protected __listenEvents(): void {
        super.__listenEvents()

        const view = this.view = this.canvas.view as HTMLCanvasElement

        // PointerEvent > TouchEvent > MouseEvent
        this.viewEvents = {
            'pointerdown': this.onPointerDown,
            'mousedown': this.onMouseDown,
            'touchstart': this.onTouchStart,

            'wheel': this.onWheel,
            'gesturestart': this.onGesturestart,
            'gesturechange': this.onGesturechange,
            'gestureend': this.onGestureend
        }

        this.windowEvents = {
            'pointermove': this.onPointerMove,
            'pointerup': this.onPointerUp,
            'pointercancel': this.onPointerCancel,

            'mousemove': this.onMouseMove,
            'mouseup': this.onMouseUp,

            // touch / multitouch
            'touchmove': this.onTouchMove,
            'touchend': this.onTouchEnd,
            'touchcancel': this.onTouchCancel,

            'keydown': this.onKeyDown,
            'keyup': this.onKeyUp
        }

        const { viewEvents, windowEvents } = this

        for (let name in viewEvents) {
            viewEvents[name] = viewEvents[name].bind(this)
            view.addEventListener(name, viewEvents[name])
        }

        for (let name in windowEvents) {
            windowEvents[name] = windowEvents[name].bind(this)
            window.addEventListener(name, windowEvents[name])
        }
    }

    protected __removeListenEvents(): void {
        super.__removeListenEvents()

        const { viewEvents, windowEvents } = this

        for (let name in viewEvents) {
            this.view.removeEventListener(name, viewEvents[name])
            this.viewEvents = {}
        }

        for (let name in windowEvents) {
            window.removeEventListener(name, windowEvents[name])
            this.windowEvents = {}
        }
    }

    protected getLocal(p: IClientPoint): IPointData {
        const viewClientBounds = this.view.getBoundingClientRect()
        return { x: p.clientX - viewClientBounds.x, y: p.clientY - viewClientBounds.y }
    }


    protected preventDefaultPointer(e: UIEvent): void {
        const { pointer } = this.config
        if (pointer.preventDefault) e.preventDefault()
    }

    protected preventDefaultWheel(e: UIEvent): void {
        const { wheel } = this.config
        if (wheel.preventDefault) e.preventDefault()
    }

    protected preventWindowPointer(e: UIEvent) {
        return !this.downData && e.target !== this.view
    }

    // key
    protected onKeyDown(e: KeyboardEvent): void {
        Keyboard.setDownCode(e.code)
    }

    protected onKeyUp(e: KeyboardEvent): void {
        Keyboard.setUpCode(e.code)
    }


    // pointer
    protected onPointerDown(e: PointerEvent): void {
        this.preventDefaultPointer(e)

        this.usePointer || (this.usePointer = true)
        if (this.useMutiTouch) return
        this.pointerDown(PointerEventHelper.convert(e, this.getLocal(e)))
    }

    protected onPointerMove(e: PointerEvent): void {
        this.usePointer || (this.usePointer = true)
        if (this.useMutiTouch || this.preventWindowPointer(e)) return
        this.pointerMove(PointerEventHelper.convert(e, this.getLocal(e)))
    }

    protected onPointerUp(e: PointerEvent): void {
        if (this.downData) this.preventDefaultPointer(e)
        if (this.useMutiTouch || this.preventWindowPointer(e)) return
        this.pointerUp(PointerEventHelper.convert(e, this.getLocal(e)))
    }

    protected onPointerCancel(): void {
        if (this.useMutiTouch) return
        this.pointerCancel()
    }


    // mouse
    protected onMouseDown(e: MouseEvent): void {
        this.preventDefaultPointer(e)

        if (this.useTouch || this.usePointer) return
        this.pointerDown(PointerEventHelper.convertMouse(e, this.getLocal(e)))
    }

    protected onMouseMove(e: MouseEvent): void {
        if (this.useTouch || this.usePointer || this.preventWindowPointer(e)) return
        this.pointerMove(PointerEventHelper.convertMouse(e, this.getLocal(e)))
    }

    protected onMouseUp(e: MouseEvent): void {
        if (this.downData) this.preventDefaultPointer(e)
        if (this.useTouch || this.usePointer || this.preventWindowPointer(e)) return
        this.pointerUp(PointerEventHelper.convertMouse(e, this.getLocal(e)))
    }

    protected onMouseCancel(): void {
        if (this.useTouch || this.usePointer) return
        this.pointerCancel()
    }


    // touch
    protected onTouchStart(e: TouchEvent): void {
        e.preventDefault()

        this.mutiTouchStart(e)

        if (this.usePointer) return
        if (this.touchTimer) {
            window.clearTimeout(this.touchTimer)
            this.touchTimer = 0
        }
        this.useTouch = true
        const touch = PointerEventHelper.getTouch(e)
        this.pointerDown(PointerEventHelper.convertTouch(e, this.getLocal(touch)))
    }

    protected onTouchMove(e: TouchEvent): void {
        this.mutiTouchMove(e)

        if (this.usePointer || this.preventWindowPointer(e)) return
        const touch = PointerEventHelper.getTouch(e)
        this.pointerMove(PointerEventHelper.convertTouch(e, this.getLocal(touch)))
    }

    protected onTouchEnd(e: TouchEvent): void {
        this.mutiTouchEnd()

        if (this.usePointer || this.preventWindowPointer(e)) return
        if (this.touchTimer) clearTimeout(this.touchTimer)
        this.touchTimer = setTimeout(() => {
            this.useTouch = false
        }, 500) // stop touch > mouse
        const touch = PointerEventHelper.getTouch(e)
        this.pointerUp(PointerEventHelper.convertTouch(e, this.getLocal(touch)))
    }

    protected onTouchCancel(): void {
        if (this.usePointer) return
        this.pointerCancel()
    }


    // mutiTouch
    protected mutiTouchStart(e: TouchEvent): void {
        this.useMutiTouch = (e.touches.length >= 2)
        this.touches = this.useMutiTouch ? MutiTouchHelper.getTouches(e.touches) : undefined
        if (this.useMutiTouch) this.pointerCancel()
    }

    protected mutiTouchMove(e: TouchEvent): void {
        if (!this.useMutiTouch) return
        if (e.touches.length >= 2) {
            const touches = MutiTouchHelper.getTouches(e.touches)
            const touch0 = touches.find(touch => touch.identifier === this.touches[0].identifier)
            const touch1 = touches.find(touch => touch.identifier === this.touches[1].identifier)

            if (touch0 && touch1) {
                const from = [this.getLocal(this.touches[0]), this.getLocal(this.touches[1])]
                const to = [this.getLocal(touch0), this.getLocal(touch1)]
                const { move, angle, scale, center } = MutiTouchHelper.getData(from, to)

                const eventBase = InteractionHelper.getBase(e)

                this.rotate(getRotateEventData(center, angle, eventBase))
                this.zoom(getZoomEventData(center, scale, eventBase))
                this.move(getMoveEventData(center, move, eventBase))

                this.touches = touches
            }
        }
    }

    protected mutiTouchEnd(): void {
        this.touches = null
        this.useMutiTouch = false
        this.transformEnd()
    }


    // wheel
    protected onWheel(e: WheelEvent): void {
        this.preventDefaultWheel(e)

        const { wheel } = this.config
        const scale = wheel.getScale ? wheel.getScale(e, wheel) : WheelEventHelper.getScale(e, wheel)
        const local = this.getLocal(e)

        const eventBase = InteractionHelper.getBase(e)
        scale !== 1 ? this.zoom(getZoomEventData(local, scale, eventBase)) : this.move(getMoveEventData(local, wheel.getMove ? wheel.getMove(e, wheel) : WheelEventHelper.getMove(e, wheel), eventBase))
    }


    // safari 
    protected onGesturestart(e: IGestureEvent): void {
        this.preventDefaultWheel(e)

        this.lastGestureScale = 1
        this.lastGestureRotation = 0
    }

    protected onGesturechange(e: IGestureEvent): void {
        this.preventDefaultWheel(e)

        const local = this.getLocal(e)
        const eventBase = InteractionHelper.getBase(e)
        const changeScale = e.scale / this.lastGestureScale
        const changeAngle = e.rotation - this.lastGestureRotation

        let { rotateSpeed } = this.config.wheel
        rotateSpeed = MathHelper.within(rotateSpeed, 0, 1)

        this.zoom(getZoomEventData(local, changeScale * changeScale, eventBase))
        this.rotate(getRotateEventData(local, changeAngle / Math.PI * 180 * (rotateSpeed / 4 + 0.1), eventBase))

        this.lastGestureScale = e.scale
        this.lastGestureRotation = e.rotation
    }

    protected onGestureend(e: IGestureEvent): void {
        this.preventDefaultWheel(e)

        this.transformEnd()
    }

    public destroy(): void {
        if (this.view) {
            super.destroy()
            this.view = null
            this.touches = null
        }
    }

}