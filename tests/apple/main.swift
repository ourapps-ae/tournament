import Foundation

var checks = 0
func expect(_ condition: Bool, _ message: String) {
    checks += 1
    if !condition { print("FAILED: \(message)"); exit(1) }
}

let players = [
    ResultPlayer(id: "d", name: "Di", place: nil, isBot: false, rebuysUsed: 0, stack: 800),
    ResultPlayer(id: "b", name: "Bea", place: 2, isBot: true, rebuysUsed: 1, stack: 0),
    ResultPlayer(id: "a", name: "Ada", place: 1, isBot: false, rebuysUsed: 0, stack: 9000),
    ResultPlayer(id: "c", name: "Cy", place: 2, isBot: false, rebuysUsed: 0, stack: 0),
]
let rows = resultRows(players, you: "a")
expect(rows.map { $0.id } == ["a", "b", "c", "d"], "placed by place, ties in listed order, unplaced last")
expect(rows.map { $0.rebought } == [false, true, false, false], "rebought only for placed players with a rebuy")
expect(rows.map { $0.showStack } == [false, false, false, true], "stack shown for the unplaced")
expect(rows[0].isYou && !rows[1].isYou, "you flag")
expect(rows[1].isComputer && !rows[0].isComputer, "computer flag")
expect(resultRows([], you: "a").isEmpty, "empty")
expect(headingKey("cancelled") == "cancelled_title" && headingKey("completed") == "standings", "heading key")
print("\(checks) result row assertions passed")
