import ae.tournament.ResultPlayer
import ae.tournament.headingKey
import ae.tournament.resultRows

fun main() {
    val players = listOf(
        ResultPlayer("d", "Di", null, false, 0, 800),
        ResultPlayer("b", "Bea", 2, true, 1, 0),
        ResultPlayer("a", "Ada", 1, false, 0, 9000),
        ResultPlayer("c", "Cy", 2, false, 0, 0),
    )
    val rows = resultRows(players, "a")
    check(rows.map { it.id } == listOf("a", "b", "c", "d"))
    check(rows.map { it.rebought } == listOf(false, true, false, false))
    check(rows.map { it.showStack } == listOf(false, false, false, true))
    check(rows[0].isYou && !rows[1].isYou)
    check(rows[1].isComputer && !rows[0].isComputer)
    check(resultRows(emptyList(), "a").isEmpty())
    check(headingKey("cancelled") == "cancelled_title" && headingKey("completed") == "standings")
    println("7 result row assertions passed")
}
