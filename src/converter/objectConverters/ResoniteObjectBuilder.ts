import { ResoniteObject } from '../../domain/ResoniteObject';
import {
  BlendModeValue,
  ColorXValue,
  buildBoxColliderComponent,
  buildGrabbableComponent,
  buildQuadMeshComponents,
} from './componentBuilders';

type QuadSize = { x: number; y: number };
type BoxSize = { x: number; y: number; z: number };

type ResoniteObjectSpec = Omit<ResoniteObject, 'components' | 'children'>;

/**
 * Fluent builder for ResoniteObject.
 *
 * Component IDs are always derived from the slot's own ID, eliminating the
 * possibility of accidentally passing a mismatched slotId to buildXXX functions.
 */
export class ResoniteObjectBuilder {
  private readonly obj: ResoniteObject;

  constructor(spec: ResoniteObjectSpec) {
    this.obj = {
      ...spec,
      components: [],
      children: [],
    };
  }

  addQuadMesh(
    textureValue?: string,
    dualSided = false,
    size: QuadSize = { x: 1, y: 1 },
    blendMode: BlendModeValue = 'Cutout',
    color?: ColorXValue
  ): this {
    this.obj.components.push(
      ...buildQuadMeshComponents(this.obj.id, textureValue, dualSided, size, blendMode, color)
    );
    return this;
  }

  addBoxCollider(size: BoxSize, options?: { characterCollider?: boolean }): this {
    this.obj.components.push(buildBoxColliderComponent(this.obj.id, size, options));
    return this;
  }

  addGrabbable(): this {
    this.obj.components.push(buildGrabbableComponent(this.obj.id));
    return this;
  }

  addTextComponent(content: string, size: number): this {
    this.obj.components.push({
      id: `${this.obj.id}-text`,
      type: '[FrooxEngine]FrooxEngine.UIX.Text',
      fields: {
        Content: { $type: 'string', value: content },
        Size: { $type: 'float', value: size },
      },
    });
    return this;
  }

  addChild(child: ResoniteObject): this {
    this.obj.children.push(child);
    return this;
  }

  addChildren(children: ResoniteObject[]): this {
    this.obj.children.push(...children);
    return this;
  }

  build(): ResoniteObject {
    return {
      ...this.obj,
      components: [...this.obj.components],
      children: [...this.obj.children],
    };
  }
}
