import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'enumToString'
})
export class EnumToStringPipe implements PipeTransform {

  transform(value: string): string {
    if(value!=null){
      return value.replace(/_/g, ' ');
    } else {
      return value;
    }
  }

}
