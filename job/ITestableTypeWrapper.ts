interface ITestableTypeWrapper<T> {
    length(source:T): Number;
  }

export default class TestableArrayWrapper implements ITestableTypeWrapper<Array<any>> {
    length(source: Array<any>|null|undefined): Number {
        if (source) {
            return source.length;
        } else {
            return 0;
        }
    }
  }