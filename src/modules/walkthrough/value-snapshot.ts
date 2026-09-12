type Scalar=string|number|boolean|null;

/** Collision-free signatures without serializing thousands of numbers per frame. */
export class ValueSnapshot {
  private previous:Scalar[]=[];
  private scratch:Scalar[]=[];
  private valid=false;
  begin():Scalar[]{this.scratch.length=0;return this.scratch;}
  invalidate():void{this.valid=false;}
  commit():boolean {
    let changed=!this.valid||this.previous.length!==this.scratch.length;
    if(!changed)for(let i=0;i<this.scratch.length;i++){
      if(!Object.is(this.previous[i],this.scratch[i])){changed=true;break;}
    }
    const old=this.previous;this.previous=this.scratch;this.scratch=old;this.valid=true;
    return changed;
  }
}
