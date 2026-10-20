import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:ocularcheck/app.dart';

void main() {
  testWidgets('OcularCheckApp renders the placeholder screen', (tester) async {
    await tester.pumpWidget(const OcularCheckApp());

    expect(find.byIcon(Icons.visibility), findsOneWidget);
    expect(
      find.byWidgetPredicate(
        (widget) =>
            widget is Semantics && widget.properties.label == 'OcularCheck AI',
      ),
      findsOneWidget,
    );
  });
}
