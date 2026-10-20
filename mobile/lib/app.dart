import 'package:flutter/material.dart';

/// Root widget of the OcularCheck application.
class OcularCheckApp extends StatelessWidget {
  /// Creates the [OcularCheckApp].
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: Center(
          child: Semantics(
            // TODO(P4-T3): move to l10n
            label: 'OcularCheck AI',
            child: const Icon(Icons.visibility),
          ),
        ),
      ),
    );
  }
}
